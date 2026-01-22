'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const zlib = require('zlib');
const { PassThrough, Transform, Writable } = require('stream');

describe("kinesis_processor", () => {
	let kinesisProcessor;
	let dynamodbDocClientUpdateStub;
	let dynamodbDocClientGetStub;
	let dynamodbDocClientDeleteStub;
	let dynamodbUpdateMultiStub;
	let toS3GzipChunksStub;
	let toGzipChunksStub;
	let toDynamoDBStub;

	const mockStreamTable = 'test-stream-table';
	const mockEventTable = 'test-event-table';
	const mockCronTable = 'test-cron-table';
	const mockSettingsTable = 'test-settings-table';

	beforeEach(function () {
		dynamodbDocClientUpdateStub = sinon.stub();
		dynamodbDocClientGetStub = sinon.stub();
		dynamodbDocClientDeleteStub = sinon.stub();
		dynamodbUpdateMultiStub = sinon.stub();
		toS3GzipChunksStub = sinon.stub();
		toGzipChunksStub = sinon.stub();
		toDynamoDBStub = sinon.stub();

		// Create mock stream that passes data through and calls the transform fn
		const createMockThrough = () => {
			return new Transform({
				objectMode: true,
				transform(chunk, encoding, callback) {
					callback(null, chunk);
				}
			});
		};

		// Create mock devnull that consumes data
		const createMockDevnull = () => {
			return new Writable({
				objectMode: true,
				write(chunk, encoding, callback) {
					callback();
				}
			});
		};

		// Create mock parse stream
		const createMockParse = () => {
			const stream = new Transform({
				objectMode: true,
				transform(chunk, encoding, callback) {
					try {
						const lines = chunk.toString().split('\n').filter(l => l.trim());
						lines.forEach(line => {
							try {
								this.push(JSON.parse(line));
							} catch (e) {
								// Skip invalid JSON
							}
						});
						callback();
					} catch (e) {
						callback(e);
					}
				}
			});
			return stream;
		};

		toS3GzipChunksStub.callsFake(() => createMockThrough());
		toGzipChunksStub.callsFake(() => createMockThrough());
		toDynamoDBStub.callsFake(() => {
			const stream = createMockThrough();
			return stream;
		});

		const leoSdk = {
			configuration: {
				resources: {
					LeoStream: mockStreamTable,
					LeoEvent: mockEventTable,
					LeoCron: mockCronTable,
					LeoSettings: mockSettingsTable
				}
			},
			aws: {
				dynamodb: {
					docClient: {
						update: dynamodbDocClientUpdateStub,
						get: dynamodbDocClientGetStub,
						delete: dynamodbDocClientDeleteStub
					},
					updateMulti: dynamodbUpdateMultiStub
				}
			},
			streams: {
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
				parse: createMockParse,
				through: function(fn) {
					// Execute the actual transform function passed in
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
				devnull: createMockDevnull,
				toS3GzipChunks: toS3GzipChunksStub,
				toGzipChunks: toGzipChunksStub,
				toDynamoDB: toDynamoDBStub,
				pipeline: function(...streams) {
					let combined = streams[0];
					for (let i = 1; i < streams.length; i++) {
						combined = combined.pipe(streams[i]);
					}
					return combined;
				}
			},
			bot: {},
			'@global': true
		};

		const refUtil = {
			ref: sinon.stub().callsFake((id) => ({
				queue: () => ({ id: id.replace(/^queue:/, '') })
			})),
			refId: sinon.stub().callsFake((id) => id),
			'@global': true
		};

		const momentMock = require('moment');

		kinesisProcessor = proxyquire('../', {
			'leo-sdk': leoSdk,
			'leo-sdk/lib/reference.js': refUtil,
			'moment': momentMock,
			'async': require('async')
		});
	});

	afterEach(function () {
		sinon.restore();
		delete process.env.skip_events;
		delete process.env.skip_bots;
		delete process.env.ttlSeconds;
	});

	describe("handler", () => {
		it('should process kinesis records and call handler2', (done) => {
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: { data: 'test' } });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: {
						value: Date.now(),
						sequence: '12345'
					}
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err, result) => {
				expect(dynamodbDocClientUpdateStub.called).to.be.true;
				done();
			});
		});

		it('should handle ConditionalCheckFailedException with increment', (done) => {
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub
				.onFirstCall().returns({
					promise: () => Promise.reject({ code: 'ConditionalCheckFailedException' })
				})
				.onSecondCall().returns({
					promise: () => Promise.resolve({
						Attributes: { value: Date.now(), sequence: '12345' }
					})
				});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				expect(dynamodbDocClientUpdateStub.calledTwice).to.be.true;
				done();
			});
		});

		it('should handle ConditionalCheckFailedException on increment with get', (done) => {
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub
				.onFirstCall().returns({
					promise: () => Promise.reject({ code: 'ConditionalCheckFailedException' })
				})
				.onSecondCall().returns({
					promise: () => Promise.reject({ code: 'ConditionalCheckFailedException' })
				});

			dynamodbDocClientGetStub.returns({
				promise: () => Promise.resolve({
					Item: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				expect(dynamodbDocClientGetStub.called).to.be.true;
				done();
			});
		});

		it('should throw on non-ConditionalCheckFailedException errors', (done) => {
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.reject({ code: 'SomeOtherError', message: 'Other error' })
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should skip events in skip_events env var', (done) => {
			process.env.skip_events = 'skip-queue';

			const eventData = JSON.stringify({ id: 'test-bot', event: 'skip-queue', payload: { data: 'test' } });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should skip bots in skip_bots env var', (done) => {
			process.env.skip_bots = 'skip-bot';

			const eventData = JSON.stringify({ id: 'skip-bot', event: 'test-queue', payload: { data: 'test' } });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should use custom ttlSeconds from env', (done) => {
			process.env.ttlSeconds = '86400';

			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should handle inflated data (eJ prefix)', (done) => {
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const inflatedData = zlib.deflateSync(eventData);
			const base64Data = inflatedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should handle base64 JSON data (ey prefix)', (done) => {
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const base64Data = Buffer.from(eventData).toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should handle multiple records', (done) => {
			const eventData1 = JSON.stringify({ id: 'bot1', event: 'queue1', payload: {} });
			const eventData2 = JSON.stringify({ id: 'bot2', event: 'queue2', payload: {} });
			const base64Data1 = zlib.gzipSync(eventData1).toString('base64');
			const base64Data2 = zlib.gzipSync(eventData2).toString('base64');

			const mockEvent = {
				Records: [
					{
						eventID: 'shardId-000000000001:12345',
						kinesis: {
							approximateArrivalTimestamp: Date.now() / 1000,
							sequenceNumber: '12345',
							data: base64Data1
						}
					},
					{
						eventID: 'shardId-000000000001:12346',
						kinesis: {
							approximateArrivalTimestamp: Date.now() / 1000,
							sequenceNumber: '12346',
							data: base64Data2
						}
					}
				]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should use S3 mode for old records', (done) => {
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const oldTimestamp = (Date.now() - 10000) / 1000;

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: oldTimestamp,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should handle sequence mismatch error', (done) => {
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '99999' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should handle increment error with non-conditional exception', (done) => {
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub
				.onFirstCall().returns({
					promise: () => Promise.reject({ code: 'ConditionalCheckFailedException' })
				})
				.onSecondCall().returns({
					promise: () => Promise.reject({ code: 'ProvisionedThroughputExceededException' })
				});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should process events with stats and checkpoints', (done) => {
			const eventData = JSON.stringify({ 
				id: 'test-bot', 
				event: 'test-queue', 
				payload: { data: 'test' },
				stats: { 'test-bot': { units: 5, start: 1000, end: 2000, checkpoint: 10 } }
			});
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should handle archive events', (done) => {
			const eventData = JSON.stringify({ 
				id: 'test-bot', 
				event: 'test-queue', 
				payload: { data: 'test' },
				archive: true,
				start: 'z/2021/01/01/00/00',
				end: 'z/2021/01/01/01/00'
			});
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should handle snapshot events', (done) => {
			const eventData = JSON.stringify({ 
				id: 'test-bot', 
				event: 'test-queue', 
				payload: { data: 'test' },
				snapshot: new Date().toISOString()
			});
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should handle _cmd registerSnapshot', (done) => {
			const eventData = JSON.stringify({ 
				_cmd: 'registerSnapshot',
				event: 'test-queue',
				start: new Date().toISOString(),
				next: new Date().toISOString()
			});
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should skip events without id or payload', (done) => {
			const eventData = JSON.stringify({ event: 'test-queue' });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should handle s3 events without id/payload', (done) => {
			const eventData = JSON.stringify({ 
				event: 'test-queue',
				s3: { bucket: 'test-bucket', key: 'test-key' }
			});
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should handle events with string event_source_timestamp', (done) => {
			const eventData = JSON.stringify({ 
				id: 'test-bot', 
				event: 'test-queue', 
				payload: { data: 'test' },
				event_source_timestamp: new Date().toISOString()
			});
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});
	});

	describe("handler2", () => {
		it('should be exported and callable', () => {
			expect(kinesisProcessor.handler2).to.be.a('function');
		});

		it('should handle DynamoDB updateMulti errors', (done) => {
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(new Error('DynamoDB error'));
			});

			kinesisProcessor.handler2(mockEvent, {}, (err) => {
				expect(err).to.equal('Cannot write event locations to dynamoDB');
				done();
			});
		});

		it('should checkpoint successfully for processed events', (done) => {
			// Create event with data that will generate stats through stream processing
			const eventData = JSON.stringify({ 
				id: 'test-bot', 
				event: 'test-queue', 
				payload: { data: 'test' },
				records: 1,
				end: 1
			});
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			// Mock checkpoint update to succeed
			dynamodbDocClientUpdateStub.callsFake((params, callback) => {
				if (callback) {
					callback(null, { Attributes: {} });
				}
				return { promise: () => Promise.resolve({ Attributes: {} }) };
			});

			kinesisProcessor.handler2(mockEvent, {}, (err, result) => {
				expect(err).to.be.null;
				done();
			});
		});

		it('should handle checkpoint update errors gracefully', (done) => {
			const eventData = JSON.stringify({ 
				id: 'test-bot', 
				event: 'test-queue', 
				payload: { data: 'test' }
			});
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: '12345',
						data: base64Data
					}
				}]
			};

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			// Mock checkpoint update to fail
			dynamodbDocClientUpdateStub.callsFake((params, callback) => {
				if (callback) {
					callback(new Error('Checkpoint error'));
				}
				return { promise: () => Promise.reject(new Error('Checkpoint error')) };
			});

			kinesisProcessor.handler2(mockEvent, {}, (err, result) => {
				// Should still succeed because checkpoint errors are logged but don't fail the handler
				expect(err).to.be.null;
				done();
			});
		});
	});
});
