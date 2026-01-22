'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const zlib = require('zlib');

describe("kinesis_processor", () => {
	let kinesisProcessor;
	let dynamodbDocClientUpdateStub;
	let dynamodbDocClientGetStub;
	let dynamodbDocClientDeleteStub;
	let dynamodbUpdateMultiStub;
	let pipeStub;
	let parseStub;
	let throughStub;
	let devnullStub;
	let toS3GzipChunksStub;
	let toGzipChunksStub;
	let toDynamoDBStub;
	let pipelineStub;

	const mockStreamTable = 'test-stream-table';
	const mockEventTable = 'test-event-table';
	const mockCronTable = 'test-cron-table';
	const mockSettingsTable = 'test-settings-table';

	beforeEach(function () {
		dynamodbDocClientUpdateStub = sinon.stub();
		dynamodbDocClientGetStub = sinon.stub();
		dynamodbDocClientDeleteStub = sinon.stub();
		dynamodbUpdateMultiStub = sinon.stub();
		pipeStub = sinon.stub();
		parseStub = sinon.stub();
		throughStub = sinon.stub().returns({});
		devnullStub = sinon.stub().returns({});
		toS3GzipChunksStub = sinon.stub().returns({});
		toGzipChunksStub = sinon.stub().returns({});
		toDynamoDBStub = sinon.stub().returns({});
		pipelineStub = sinon.stub().returns({
			write: sinon.stub(),
			end: sinon.stub(),
			on: sinon.stub().returnsThis()
		});

		// Create a mock writable stream for parse
		const mockParseStream = {
			write: sinon.stub(),
			end: sinon.stub()
		};
		parseStub.returns(mockParseStream);

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
				pipe: pipeStub,
				parse: parseStub,
				through: throughStub,
				devnull: devnullStub,
				toS3GzipChunks: toS3GzipChunksStub,
				toGzipChunks: toGzipChunksStub,
				toDynamoDB: toDynamoDBStub,
				pipeline: pipelineStub
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
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

			// First call fails with ConditionalCheckFailedException
			// Second call (increment) succeeds
			dynamodbDocClientUpdateStub
				.onFirstCall().returns({
					promise: () => Promise.reject({ code: 'ConditionalCheckFailedException' })
				})
				.onSecondCall().returns({
					promise: () => Promise.resolve({
						Attributes: { value: Date.now(), sequence: '12345' }
					})
				});

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
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

			// First call fails, second call (increment) also fails with ConditionalCheckFailedException
			// Then get is called
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				// Handler catches the error and continues
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should update timestamp when value differs', (done) => {
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			const oldTimestamp = Date.now() / 1000;
			const newValue = (oldTimestamp + 10) * 1000; // Higher value

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
					Attributes: { value: newValue, sequence: '12345' }
				})
			});

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				// The approximateArrivalTimestamp should be updated
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
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

			// Use a timestamp from 10 seconds ago to trigger S3 mode
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});

		it('should use S3 mode for large batch', (done) => {
			const eventData = JSON.stringify({ id: 'test-bot', event: 'test-queue', payload: {} });
			const gzippedData = zlib.gzipSync(eventData);
			const base64Data = gzippedData.toString('base64');

			// Create more than 100 records to trigger S3 mode
			const records = [];
			for (let i = 0; i < 101; i++) {
				records.push({
					eventID: `shardId-000000000001:${12345 + i}`,
					kinesis: {
						approximateArrivalTimestamp: Date.now() / 1000,
						sequenceNumber: `${12345 + i}`,
						data: base64Data
					}
				});
			}

			const mockEvent = { Records: records };

			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '12345' }
				})
			});

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
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

			// Return a different sequence to trigger mismatch
			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: { value: Date.now(), sequence: '99999' }
				})
			});

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(null);
			});

			kinesisProcessor.handler(mockEvent, {}, (err) => {
				// Error is caught and logged
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
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

		it('should handle pipe errors', (done) => {
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(new Error('Pipe error'));
				}
			});

			kinesisProcessor.handler2(mockEvent, {}, (err) => {
				expect(err).to.be.instanceof(Error);
				done();
			});
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

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				if (typeof callback === 'function') {
					callback(null);
				}
			});

			dynamodbUpdateMultiStub.callsFake((tasks, callback) => {
				callback(new Error('DynamoDB error'));
			});

			kinesisProcessor.handler2(mockEvent, {}, (err) => {
				expect(err).to.equal('Cannot write event locations to dynamoDB');
				done();
			});
		});
	});
});
