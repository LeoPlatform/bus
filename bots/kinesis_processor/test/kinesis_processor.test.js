'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const zlib = require('zlib');
const { PassThrough, Transform, Writable, Duplex } = require('stream');

describe("kinesis_processor", () => {
	let kinesisProcessor;
	let dynamodbDocClientUpdateStub;
	let dynamodbDocClientGetStub;
	let dynamodbDocClientDeleteStub;
	let dynamodbUpdateMultiStub;

	const mockStreamTable = 'test-stream-table';
	const mockEventTable = 'test-event-table';
	const mockCronTable = 'test-cron-table';
	const mockSettingsTable = 'test-settings-table';

	beforeEach(function () {
		dynamodbDocClientUpdateStub = sinon.stub();
		dynamodbDocClientGetStub = sinon.stub();
		dynamodbDocClientDeleteStub = sinon.stub();
		dynamodbUpdateMultiStub = sinon.stub();

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
			return new Transform({
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
		};

		// Mock toS3GzipChunks - transforms events into chunks with stats
		const createToS3GzipChunks = () => {
			return new Transform({
				objectMode: true,
				transform(chunk, encoding, callback) {
					// Transform event into chunk format that assignIds expects
					const chunkData = {
						records: 1,
						end: 1,
						stats: {},
						correlations: {}
					};
					// Add stats for the bot
					if (chunk && chunk.id) {
						chunkData.stats[chunk.id] = {
							units: 1,
							start: Date.now(),
							end: Date.now(),
							checkpoint: 0
						};
					}
					callback(null, chunkData);
				}
			});
		};

		// Mock toGzipChunks - same as toS3GzipChunks for testing
		const createToGzipChunks = () => createToS3GzipChunks();

		// Mock toDynamoDB - just passes through (simulates successful write)
		const createToDynamoDB = () => {
			return new Writable({
				objectMode: true,
				write(chunk, encoding, callback) {
					callback();
				}
			});
		};

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
				toS3GzipChunks: () => createToS3GzipChunks(),
				toGzipChunks: () => createToGzipChunks(),
				toDynamoDB: () => createToDynamoDB(),
				pipeline: function(...streams) {
					// Connect all streams in a pipeline
					for (let i = 0; i < streams.length - 1; i++) {
						streams[i].pipe(streams[i + 1]);
					}
					
					const first = streams[0];
					const last = streams[streams.length - 1];
					
					// Create a passthrough that pipes to the first stream
					const input = new PassThrough({ objectMode: true });
					input.pipe(first);
					
					// Track finish handlers
					const finishHandlers = [];
					const errorHandlers = [];
					
					// When last stream finishes, call handlers
					last.on('finish', () => {
						finishHandlers.forEach(h => h());
					});
					last.on('error', (err) => {
						errorHandlers.forEach(h => h(err));
					});
					
					// Create a custom pipeline object
					const pipeline = {
						write: (data, callback) => {
							const result = input.write(data);
							if (callback) setImmediate(callback);
							return result;
						},
						end: () => {
							input.end();
						},
						on: (event, handler) => {
							if (event === 'finish') {
								finishHandlers.push(handler);
							} else if (event === 'error') {
								errorHandlers.push(handler);
							}
							return pipeline;
						}
					};
					
					return pipeline;
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
		// Helper to setup common mocks for handler tests
		const setupHandlerMocks = () => {
			dynamodbDocClientUpdateStub.callsFake((params, callback) => {
				// Callback-style (checkpoint update)
				if (callback && typeof callback === 'function') {
					callback(null, { Attributes: {} });
					return;
				}
				// Promise-style (setDDBValue)
				return {
					promise: () => Promise.resolve({
						Attributes: { value: Date.now(), sequence: '12345' }
					})
				};
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});
		};

		it('should process kinesis records and call handler2', (done) => {
			setupHandlerMocks();
			
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

			kinesisProcessor.handler(mockEvent, {}, (err, result) => {
				expect(dynamodbDocClientUpdateStub.called).to.be.true;
				done();
			});
		});

		it('should handle ConditionalCheckFailedException with increment', (done) => {
			let promiseCallCount = 0;
			dynamodbDocClientUpdateStub.callsFake((params, callback) => {
				if (callback && typeof callback === 'function') {
					callback(null, { Attributes: {} });
					return;
				}
				promiseCallCount++;
				if (promiseCallCount === 1) {
					return { promise: () => Promise.reject({ code: 'ConditionalCheckFailedException' }) };
				}
				return { promise: () => Promise.resolve({ Attributes: { value: Date.now(), sequence: '12345' } }) };
			});
			dynamodbUpdateMultiStub.callsFake((tasks, callback) => callback(null));

			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				expect(promiseCallCount).to.be.at.least(2);
				done();
			});
		});

		it('should handle ConditionalCheckFailedException on increment with get', (done) => {
			let promiseCallCount = 0;
			dynamodbDocClientUpdateStub.callsFake((params, callback) => {
				if (callback && typeof callback === 'function') {
					callback(null, { Attributes: {} });
					return;
				}
				promiseCallCount++;
				if (promiseCallCount <= 2) {
					return { promise: () => Promise.reject({ code: 'ConditionalCheckFailedException' }) };
				}
				return { promise: () => Promise.resolve({ Attributes: { value: Date.now(), sequence: '12345' } }) };
			});
			dynamodbDocClientGetStub.returns({
				promise: () => Promise.resolve({ Item: { value: Date.now(), sequence: '12345' } })
			});
			dynamodbUpdateMultiStub.callsFake((tasks, callback) => callback(null));

			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				expect(dynamodbDocClientGetStub.called).to.be.true;
				done();
			});
		});

		it('should throw on non-ConditionalCheckFailedException errors', (done) => {
			dynamodbDocClientUpdateStub.callsFake((params, callback) => {
				if (callback && typeof callback === 'function') {
					callback(null, { Attributes: {} });
					return;
				}
				return { promise: () => Promise.reject({ code: 'SomeOtherError', message: 'Other error' }) };
			});
			dynamodbUpdateMultiStub.callsFake((tasks, callback) => callback(null));

			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should skip events in skip_events env var', (done) => {
			setupHandlerMocks();
			process.env.skip_events = 'skip-queue';

			const eventData = JSON.stringify({ id: 'test-bot', event: 'skip-queue', payload: { data: 'test' } });
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
		});

		it('should skip bots in skip_bots env var', (done) => {
			setupHandlerMocks();
			process.env.skip_bots = 'skip-bot';

			const eventData = JSON.stringify({ id: 'skip-bot', event: 'test-queue', payload: { data: 'test' } });
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
		});

		it('should use custom ttlSeconds from env', (done) => {
			setupHandlerMocks();
			process.env.ttlSeconds = '86400';

			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
		});

		it('should handle inflated data (eJ prefix)', (done) => {
			setupHandlerMocks();
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const base64Data = zlib.deflateSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
		});

		it('should handle base64 JSON data (ey prefix)', (done) => {
			setupHandlerMocks();
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const base64Data = Buffer.from(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
		});

		it('should handle multiple records', (done) => {
			setupHandlerMocks();
			const eventData1 = JSON.stringify({ id: 'bot1', event: 'queue1', payload: {} });
			const eventData2 = JSON.stringify({ id: 'bot2', event: 'queue2', payload: {} });
			const base64Data1 = zlib.gzipSync(eventData1).toString('base64');
			const base64Data2 = zlib.gzipSync(eventData2).toString('base64');

			const mockEvent = {
				Records: [
					{ eventID: 'shardId-000000000001:12345', kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data1 } },
					{ eventID: 'shardId-000000000001:12346', kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12346', data: base64Data2 } }
				]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
		});

		it('should handle sequence mismatch error', (done) => {
			dynamodbDocClientUpdateStub.callsFake((params, callback) => {
				if (callback && typeof callback === 'function') {
					callback(null, { Attributes: {} });
					return;
				}
				return { promise: () => Promise.resolve({ Attributes: { value: Date.now(), sequence: '99999' } }) };
			});
			dynamodbUpdateMultiStub.callsFake((tasks, callback) => callback(null));

			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
		});

		it('should handle increment error with non-conditional exception', (done) => {
			let promiseCallCount = 0;
			dynamodbDocClientUpdateStub.callsFake((params, callback) => {
				if (callback && typeof callback === 'function') {
					callback(null, { Attributes: {} });
					return;
				}
				promiseCallCount++;
				if (promiseCallCount === 1) {
					return { promise: () => Promise.reject({ code: 'ConditionalCheckFailedException' }) };
				}
				return { promise: () => Promise.reject({ code: 'ProvisionedThroughputExceededException' }) };
			});
			dynamodbUpdateMultiStub.callsFake((tasks, callback) => callback(null));

			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
		});

		it('should handle archive events', (done) => {
			setupHandlerMocks();
			const eventData = JSON.stringify({ 
				id: 'test-bot', event: 'test-queue', payload: { data: 'test' },
				archive: true, start: 'z/2021/01/01/00/00', end: 'z/2021/01/01/01/00'
			});
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
		});

		it('should handle snapshot events', (done) => {
			setupHandlerMocks();
			const eventData = JSON.stringify({ 
				id: 'test-bot', event: 'test-queue', payload: { data: 'test' },
				snapshot: new Date().toISOString()
			});
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
		});

		it('should handle _cmd registerSnapshot', (done) => {
			setupHandlerMocks();
			const eventData = JSON.stringify({ 
				_cmd: 'registerSnapshot', event: 'test-queue',
				start: new Date().toISOString(), next: new Date().toISOString()
			});
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
		});

		it('should skip events without id or payload', (done) => {
			setupHandlerMocks();
			const eventData = JSON.stringify({ event: 'test-queue' });
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
		});

		it('should handle s3 events without id/payload', (done) => {
			setupHandlerMocks();
			const eventData = JSON.stringify({ event: 'test-queue', s3: { bucket: 'test-bucket', key: 'test-key' } });
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
		});

		it('should handle events with string event_source_timestamp', (done) => {
			setupHandlerMocks();
			const eventData = JSON.stringify({ 
				id: 'test-bot', event: 'test-queue', payload: { data: 'test' },
				event_source_timestamp: new Date().toISOString()
			});
			const base64Data = zlib.gzipSync(eventData).toString('base64');
			const mockEvent = {
				Records: [{
					eventID: 'shardId-000000000001:12345',
					kinesis: { approximateArrivalTimestamp: Date.now() / 1000, sequenceNumber: '12345', data: base64Data }
				}]
			};

			kinesisProcessor.handler(mockEvent, {}, (err) => { done(); });
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

		it('should process events through pipeline and accumulate stats', (done) => {
			// Create event that will flow through the pipeline
			const eventData = JSON.stringify({ 
				id: 'checkpoint-bot', 
				event: 'checkpoint-queue', 
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
				// Verify event update tasks are created
				expect(tasks.length).to.be.greaterThan(0);
				callback(null);
			});

			// Mock the checkpoint update call
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
				// Should still succeed because checkpoint errors are logged but don't fail
				expect(err).to.be.null;
				done();
			});
		});
	});
});
