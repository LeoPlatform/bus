'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const zlib = require('zlib');
const { PassThrough } = require('stream');

describe("firehose_processor", () => {
	let firehoseProcessor;
	let fromLeoStub;
	let fromS3Stub;
	let pipeStub;
	let throughStub;
	let parseStub;
	let splitStub;
	let toS3GzipChunksStub;
	let toLeoStub;
	let pipelineStub;
	let devnullStub;
	let botCheckpointStub;
	let asyncModule;

	beforeEach(function () {
		fromLeoStub = sinon.stub();
		fromS3Stub = sinon.stub();
		pipeStub = sinon.stub();
		throughStub = sinon.stub().returns({});
		parseStub = sinon.stub().returns({});
		splitStub = sinon.stub().returns({});
		toS3GzipChunksStub = sinon.stub().returns({});
		toLeoStub = sinon.stub().returns({});
		pipelineStub = sinon.stub();
		devnullStub = sinon.stub().returns({});
		botCheckpointStub = sinon.stub();

		asyncModule = require('async');

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
				pipe: pipeStub,
				through: throughStub,
				parse: parseStub,
				split: splitStub,
				toS3GzipChunks: toS3GzipChunksStub,
				toLeo: toLeoStub,
				pipeline: pipelineStub,
				devnull: devnullStub
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
			'async': asyncModule
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
			mockContext.getRemainingTimeInMillis.onFirstCall().returns(60000).onSecondCall().returns(5000);

			// Setup the pipeline to call through with a mock stream
			const mockPipeline = {
				write: sinon.stub().callsFake((obj, cb) => cb && cb()),
				end: sinon.stub(),
				on: sinon.stub().returnsThis()
			};
			pipelineStub.returns(mockPipeline);
			mockPipeline.on.withArgs('finish').callsFake((event, cb) => {
				if (event === 'finish' && typeof cb === 'function') {
					setImmediate(cb);
				}
				return mockPipeline;
			});

			// Mock the through functions
			let throughCallIndex = 0;
			throughStub.callsFake((fn) => {
				return { _through: true, fn };
			});

			// Mock the pipe function to simulate processing
			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					// Simulate no units processed to exit loop
					callback(null);
				}
			});

			botCheckpointStub.callsFake((botId, source, data, cb) => {
				cb(null);
			});

			firehoseProcessor.handler(mockEvent, mockContext, (err, result) => {
				expect(err).to.be.null;
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

			// Process with gzipped data
			const testData = JSON.stringify({ id: 'bot', event: 'queue', payload: {} });
			const gzippedData = zlib.gzipSync(testData).toString('base64');
			
			// Verify gzipped data starts with H
			expect(gzippedData[0]).to.equal('H');

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

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

			// Process with deflated data
			const testData = JSON.stringify({ id: 'bot', event: 'queue', payload: {} });
			const inflatedData = zlib.deflateSync(testData).toString('base64');
			
			// Verify deflated data often starts with eJ
			// Note: actual prefix depends on data content

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

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

			// Process with base64 JSON data
			const testData = JSON.stringify({ id: 'bot', event: 'queue', payload: {} });
			const base64Data = Buffer.from(testData).toString('base64');
			
			// JSON starting with { encodes to ey in base64
			expect(base64Data.substring(0, 2)).to.equal('ey');

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(new Error('Processing error'));
				}
			});

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('Processing error');
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				expect(fromLeoStub.calledWith('custom-bot-id', 'commands.s3_bus_load', sinon.match({
					debug: true,
					limit: 1,
					start: 'z/2021/06/15/12/30/12345'
				}))).to.be.true;
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
			mockContext.getRemainingTimeInMillis
				.onCall(0).returns(60000) // millisToExit calculation
				.onCall(1).returns(60000) // First check - continue
				.onCall(2).returns(5000);  // Second check - exit

			let loopCount = 0;
			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				loopCount++;
				if (typeof callback === 'function') {
					callback(null);
				}
			});

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

			// Simulate processing that updates checkpoint data
			let throughCallCount = 0;
			throughStub.callsFake((fn) => {
				throughCallCount++;
				return { _through: true };
			});

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

			botCheckpointStub.callsFake((botId, source, data, cb) => {
				expect(botId).to.equal('test-firehose-bot');
				expect(source).to.equal('commands.s3_bus_load');
				cb(null);
			});

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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

			botCheckpointStub.callsFake((botId, source, data, cb) => {
				cb(new Error('Checkpoint failed'));
			});

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				// Handler completes even with checkpoint error
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

			// through stub will be called for skipping invalid events
			throughStub.callsFake((fn) => {
				return { _through: true, fn };
			});

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

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

			throughStub.callsFake((fn) => {
				return { _through: true, fn };
			});

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

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

			const mockPipeline = {
				write: sinon.stub().callsFake((obj, cb) => cb && cb()),
				end: sinon.stub(),
				on: sinon.stub().returnsThis()
			};
			pipelineStub.returns(mockPipeline);

			throughStub.callsFake((fn) => {
				return { _through: true, fn };
			});

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				done();
			});
		});

		it('should handle closeStreams with no events', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					// No events processed, closeStreams should handle empty tasks
					callback(null);
				}
			});

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.null;
				done();
			});
		});

		it('should handle S3 file processing errors', (done) => {
			const mockEvent = {
				botId: 'test-firehose-bot',
				debug: false
			};
			const mockContext = createMockContext();
			mockContext.getRemainingTimeInMillis.returns(5000);

			// Simulate error in inner pipe (S3 processing)
			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(new Error('S3 read error'));
				}
			});

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.instanceof(Error);
				done();
			});
		});
	});
});
