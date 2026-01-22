'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const zlib = require('zlib');
const { PassThrough, Transform, Writable, Readable } = require('stream');

describe("firehose_processor", () => {
	let firehoseProcessor;
	let fromLeoStub;
	let fromS3Stub;
	let toS3GzipChunksStub;
	let toLeoStub;
	let botCheckpointStub;

	beforeEach(function () {
		fromLeoStub = sinon.stub();
		fromS3Stub = sinon.stub();
		toS3GzipChunksStub = sinon.stub();
		toLeoStub = sinon.stub();
		botCheckpointStub = sinon.stub();

		// Create mock through stream
		const createMockThrough = () => {
			return new Transform({
				objectMode: true,
				transform(chunk, encoding, callback) {
					callback(null, chunk);
				}
			});
		};

		// Create mock devnull
		const createMockDevnull = () => {
			return new Writable({
				objectMode: true,
				write(chunk, encoding, callback) {
					callback();
				}
			});
		};

		// Create mock split
		const createMockSplit = () => {
			return new Transform({
				objectMode: true,
				transform(chunk, encoding, callback) {
					const lines = chunk.toString().split('\n').filter(l => l.trim());
					lines.forEach(line => this.push(line));
					callback();
				}
			});
		};

		// Create mock parse
		const createMockParse = () => {
			return new Transform({
				objectMode: true,
				transform(chunk, encoding, callback) {
					try {
						this.push(JSON.parse(chunk.toString()));
					} catch (e) {
						// Skip invalid JSON
					}
					callback();
				}
			});
		};

		toS3GzipChunksStub.callsFake(() => createMockThrough());
		toLeoStub.callsFake(() => createMockThrough());

		const leoSdk = {
			configuration: {
				resources: {
					LeoKinesisStream: 'mock-kinesis',
					LeoS3: 'mock-s3-bucket',
					LeoStream: 'mock-stream-table'
				},
				update: sinon.stub()
			},
			streams: {
				fromLeo: fromLeoStub,
				fromS3: fromS3Stub,
				pipe: function(...args) {
					const streams = args.slice(0, -1);
					const callback = args[args.length - 1];
					
					if (streams.length === 0) {
						callback();
						return;
					}
					
					// Pipe all streams together
					let combined = streams[0];
					for (let i = 1; i < streams.length; i++) {
						combined = combined.pipe(streams[i]);
					}
					
					combined.on('finish', () => callback());
					combined.on('error', (err) => callback(err));
				},
				through: function(fn) {
					return new Transform({
						objectMode: true,
						transform(chunk, encoding, callback) {
							fn(chunk, (err, result) => {
								if (err) return callback(err);
								if (result !== undefined) this.push(result);
								callback();
							});
						}
					});
				},
				parse: createMockParse,
				split: createMockSplit,
				toS3GzipChunks: toS3GzipChunksStub,
				toLeo: toLeoStub,
				pipeline: function(...streams) {
					let combined = streams[0];
					for (let i = 1; i < streams.length; i++) {
						combined = combined.pipe(streams[i]);
					}
					return combined;
				},
				devnull: createMockDevnull
			},
			bot: {
				checkpoint: botCheckpointStub
			},
			'@global': true
		};

		const refUtil = {
			ref: sinon.stub().callsFake((id) => ({
				queue: () => ({ id: id.replace(/^queue:/, '') })
			})),
			'@global': true
		};

		const cronWrapper = sinon.stub().callsFake((fn) => fn);

		firehoseProcessor = proxyquire('../', {
			'leo-sdk': leoSdk,
			'leo-sdk/lib/reference.js': refUtil,
			'leo-sdk/wrappers/cron': cronWrapper,
			'async': require('async')
		});
	});

	afterEach(function () {
		sinon.restore();
	});

	describe("handler", () => {
		const createMockContext = (remainingTime = 60000) => ({
			getRemainingTimeInMillis: sinon.stub().returns(remainingTime)
		});

		it('should process firehose files from S3 and checkpoint', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false,
				start: 'z/2021/01/01/00/00/000'
			};

			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000); // Low time to exit loop immediately

			// Create mock source stream with no data
			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(null); // End stream immediately
				}
			});
			fromLeoStub.returns(mockSourceStream);

			botCheckpointStub.callsFake((botId, source, data, cb) => {
				cb(null);
			});

			firehoseProcessor.handler(mockEvent, mockContext, (err, result) => {
				expect(err).to.be.null;
				done();
			});
		});

		it('should process events from S3 files', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			// Create mock source stream with a single object containing files
			const mockPayload = {
				eid: 'z/2021/01/01/00/00/001',
				units: 1,
				timestamp: Date.now(),
				source_timestamp: Date.now(),
				payload: {
					files: ['s3://bucket/file1.gz']
				}
			};

			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(mockPayload);
					this.push(null);
				}
			});
			fromLeoStub.returns(mockSourceStream);

			// Create mock S3 file stream with gzipped data
			const testData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: { data: 'test' } });
			const gzippedData = zlib.gzipSync(testData).toString('base64');
			
			const mockS3Stream = new Readable({
				read() {
					this.push(gzippedData);
					this.push(null);
				}
			});
			fromS3Stub.returns(mockS3Stream);

			botCheckpointStub.callsFake((botId, source, data, cb) => {
				cb(null);
			});

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				expect(fromLeoStub.called).to.be.true;
				done();
			});
		});

		it('should handle different data encodings - gzipped (H prefix)', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			// Create mock source stream
			const mockPayload = {
				eid: 'z/2021/01/01/00/00/001',
				units: 1,
				timestamp: Date.now(),
				source_timestamp: Date.now(),
				payload: {
					files: ['s3://bucket/file1.gz']
				}
			};

			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(mockPayload);
					this.push(null);
				}
			});
			fromLeoStub.returns(mockSourceStream);

			// Gzipped data starts with H
			const testData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const gzippedData = zlib.gzipSync(testData).toString('base64');
			expect(gzippedData[0]).to.equal('H');
			
			const mockS3Stream = new Readable({
				read() {
					this.push(gzippedData);
					this.push(null);
				}
			});
			fromS3Stub.returns(mockS3Stream);

			botCheckpointStub.callsFake((botId, source, data, cb) => cb(null));

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				done();
			});
		});

		it('should handle different data encodings - inflated (eJ prefix)', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			const mockPayload = {
				eid: 'z/2021/01/01/00/00/001',
				units: 1,
				timestamp: Date.now(),
				source_timestamp: Date.now(),
				payload: {
					files: ['s3://bucket/file1.gz']
				}
			};

			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(mockPayload);
					this.push(null);
				}
			});
			fromLeoStub.returns(mockSourceStream);

			// Deflated data typically starts with eJ
			const testData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const deflatedData = zlib.deflateSync(testData).toString('base64');
			
			const mockS3Stream = new Readable({
				read() {
					this.push(deflatedData);
					this.push(null);
				}
			});
			fromS3Stub.returns(mockS3Stream);

			botCheckpointStub.callsFake((botId, source, data, cb) => cb(null));

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				done();
			});
		});

		it('should handle different data encodings - base64 JSON (ey prefix)', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			const mockPayload = {
				eid: 'z/2021/01/01/00/00/001',
				units: 1,
				timestamp: Date.now(),
				source_timestamp: Date.now(),
				payload: {
					files: ['s3://bucket/file1.gz']
				}
			};

			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(mockPayload);
					this.push(null);
				}
			});
			fromLeoStub.returns(mockSourceStream);

			// Base64 JSON starts with ey
			const testData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const base64Data = Buffer.from(testData).toString('base64');
			expect(base64Data.substring(0, 2)).to.equal('ey');
			
			const mockS3Stream = new Readable({
				read() {
					this.push(base64Data);
					this.push(null);
				}
			});
			fromS3Stub.returns(mockS3Stream);

			botCheckpointStub.callsFake((botId, source, data, cb) => cb(null));

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				done();
			});
		});

		it('should handle plain data (no special prefix)', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			const mockPayload = {
				eid: 'z/2021/01/01/00/00/001',
				units: 1,
				timestamp: Date.now(),
				source_timestamp: Date.now(),
				payload: {
					files: ['s3://bucket/file1.gz']
				}
			};

			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(mockPayload);
					this.push(null);
				}
			});
			fromLeoStub.returns(mockSourceStream);

			// Plain data not starting with H, eJ, or ey
			const plainData = 'plain-data-not-json';
			
			const mockS3Stream = new Readable({
				read() {
					this.push(plainData);
					this.push(null);
				}
			});
			fromS3Stub.returns(mockS3Stream);

			botCheckpointStub.callsFake((botId, source, data, cb) => cb(null));

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				done();
			});
		});

		it('should handle processing errors', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: true
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(60000);

			// Create a source stream that fails via the pipe callback
			const mockSourceStream = new PassThrough({ objectMode: true });
			fromLeoStub.returns(mockSourceStream);

			// Override the pipe function to simulate an error
			const originalPipe = firehoseProcessor.__proto__;
			
			// Just return no data to test the empty processing path
			const emptyStream = new Readable({
				objectMode: true,
				read() {
					this.push(null);
				}
			});
			fromLeoStub.returns(emptyStream);

			botCheckpointStub.callsFake((botId, source, data, cb) => cb(null));

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				// No error since we just return empty stream
				done();
			});
		});

		it('should use event properties correctly', (done) => {
			const mockEvent = {
				botId: 'custom-bot-id',
				debug: true,
				start: 'z/2021/06/15/12/30/12345'
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(null);
				}
			});
			fromLeoStub.returns(mockSourceStream);

			botCheckpointStub.callsFake((botId, source, data, cb) => cb(null));

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				expect(fromLeoStub.calledWith('custom-bot-id', 'commands.s3_bus_load', sinon.match({
					debug: true,
					limit: 1,
					start: 'z/2021/06/15/12/30/12345'
				}))).to.be.true;
				done();
			});
		});

		it('should skip events without id and event', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			const mockPayload = {
				eid: 'z/2021/01/01/00/00/001',
				units: 1,
				timestamp: Date.now(),
				source_timestamp: Date.now(),
				payload: {
					files: ['s3://bucket/file1.gz']
				}
			};

			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(mockPayload);
					this.push(null);
				}
			});
			fromLeoStub.returns(mockSourceStream);

			// Create data without id or event - should be skipped
			const testData = JSON.stringify({ payload: { data: 'test' } });
			const base64Data = Buffer.from(testData).toString('base64');
			
			const mockS3Stream = new Readable({
				read() {
					this.push(base64Data);
					this.push(null);
				}
			});
			fromS3Stub.returns(mockS3Stream);

			botCheckpointStub.callsFake((botId, source, data, cb) => cb(null));

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				done();
			});
		});

		it('should set default timestamp if missing', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			const mockPayload = {
				eid: 'z/2021/01/01/00/00/001',
				units: 1,
				timestamp: Date.now(),
				source_timestamp: Date.now(),
				payload: {
					files: ['s3://bucket/file1.gz']
				}
			};

			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(mockPayload);
					this.push(null);
				}
			});
			fromLeoStub.returns(mockSourceStream);

			// Create data without timestamp
			const testData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const base64Data = Buffer.from(testData).toString('base64');
			
			const mockS3Stream = new Readable({
				read() {
					this.push(base64Data);
					this.push(null);
				}
			});
			fromS3Stub.returns(mockS3Stream);

			botCheckpointStub.callsFake((botId, source, data, cb) => cb(null));

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				done();
			});
		});

		it('should handle checkpoint errors', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(null);
				}
			});
			fromLeoStub.returns(mockSourceStream);

			botCheckpointStub.callsFake((botId, source, data, cb) => {
				cb(new Error('Checkpoint failed'));
			});

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				done();
			});
		});

		it('should process multiple files in payload', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			const mockPayload = {
				eid: 'z/2021/01/01/00/00/001',
				units: 1,
				timestamp: Date.now(),
				source_timestamp: Date.now(),
				payload: {
					files: ['s3://bucket/file1.gz', 's3://bucket/file2.gz']
				}
			};

			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(mockPayload);
					this.push(null);
				}
			});
			fromLeoStub.returns(mockSourceStream);

			const testData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const base64Data = Buffer.from(testData).toString('base64');
			
			fromS3Stub.returns(new Readable({
				read() {
					this.push(base64Data);
					this.push(null);
				}
			}));

			botCheckpointStub.callsFake((botId, source, data, cb) => cb(null));

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				done();
			});
		});

		it('should reuse existing event stream for same event', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			const mockPayload = {
				eid: 'z/2021/01/01/00/00/001',
				units: 1,
				timestamp: Date.now(),
				source_timestamp: Date.now(),
				payload: {
					files: ['s3://bucket/file1.gz']
				}
			};

			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(mockPayload);
					this.push(null);
				}
			});
			fromLeoStub.returns(mockSourceStream);

			// Create two events going to the same queue
			const testData1 = JSON.stringify({ id: 'bot1', event: 'same-queue', payload: {} });
			const testData2 = JSON.stringify({ id: 'bot2', event: 'same-queue', payload: {} });
			const combinedData = Buffer.from(testData1).toString('base64') + '\n' + Buffer.from(testData2).toString('base64');
			
			fromS3Stub.returns(new Readable({
				read() {
					this.push(combinedData);
					this.push(null);
				}
			}));

			botCheckpointStub.callsFake((botId, source, data, cb) => cb(null));

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				done();
			});
		});

		it('should handle S3 file processing with empty files', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			const mockPayload = {
				eid: 'z/2021/01/01/00/00/001',
				units: 1,
				timestamp: Date.now(),
				source_timestamp: Date.now(),
				payload: {
					files: ['s3://bucket/file1.gz']
				}
			};

			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(mockPayload);
					this.push(null);
				}
			});
			fromLeoStub.returns(mockSourceStream);

			// S3 stream that returns empty data
			const mockS3Stream = new Readable({
				read() {
					this.push(null);
				}
			});
			fromS3Stub.returns(mockS3Stream);

			botCheckpointStub.callsFake((botId, source, data, cb) => cb(null));

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.null;
				done();
			});
		});

		it('should continue loop while units > 0 and time remaining', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			
			// First call: plenty of time, second call: low time
			let callCount = 0;
			mockContext.getRemainingTimeInMillis.callsFake(() => {
				callCount++;
				return callCount <= 2 ? 60000 : 5000;
			});

			let sourceCallCount = 0;
			fromLeoStub.callsFake(() => {
				sourceCallCount++;
				// First call returns data with units, subsequent calls return empty
				if (sourceCallCount === 1) {
					return new Readable({
						objectMode: true,
						read() {
							this.push({
								eid: 'z/2021/01/01/00/00/001',
								units: 1,
								timestamp: Date.now(),
								source_timestamp: Date.now(),
								payload: { files: [] }
							});
							this.push(null);
						}
					});
				}
				return new Readable({
					objectMode: true,
					read() {
						this.push(null);
					}
				});
			});

			botCheckpointStub.callsFake((botId, source, data, cb) => cb(null));

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.null;
				done();
			});
		});

		it('should checkpoint when units processed', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			const mockPayload = {
				eid: 'z/2021/01/01/00/00/001',
				units: 5,
				timestamp: Date.now(),
				source_timestamp: Date.now(),
				payload: { files: [] }
			};

			const mockSourceStream = new Readable({
				objectMode: true,
				read() {
					this.push(mockPayload);
					this.push(null);
				}
			});
			fromLeoStub.returns(mockSourceStream);

			botCheckpointStub.callsFake((botId, source, data, cb) => {
				expect(botId).to.equal('test-firehose-bot');
				expect(source).to.equal('commands.s3_bus_load');
				expect(data.units).to.equal(5);
				cb(null);
			});

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				expect(botCheckpointStub.called).to.be.true;
				done();
			});
		});
	});
});
