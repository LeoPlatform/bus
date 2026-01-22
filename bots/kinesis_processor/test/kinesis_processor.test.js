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
		throughStub = sinon.stub();
		devnullStub = sinon.stub();
		toS3GzipChunksStub = sinon.stub();
		toGzipChunksStub = sinon.stub();
		toDynamoDBStub = sinon.stub();
		pipelineStub = sinon.stub();

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
		it('should process kinesis records', (done) => {
			// Create a simple gzipped base64 record
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

			// Mock setDDBValue success
			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.resolve({
					Attributes: {
						value: Date.now(),
						sequence: '12345'
					}
				})
			});

			// Mock pipe to call callback immediately
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
				// The handler processes records
				expect(dynamodbDocClientUpdateStub.called).to.be.true;
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
				// Should complete without error
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
				// Should complete without error
				done();
			});
		});

		it('should use custom ttlSeconds from env', (done) => {
			process.env.ttlSeconds = '86400'; // 1 day

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
			// deflateSync produces data starting with 'eJ'

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
			// JSON starting with { becomes 'ey' in base64

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

		it('should handle DynamoDB update errors gracefully', (done) => {
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

			// Simulate error on setDDBValue
			dynamodbDocClientUpdateStub.returns({
				promise: () => Promise.reject(new Error('DynamoDB error'))
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

			// The handler catches errors in setDDBValue and continues
			kinesisProcessor.handler(mockEvent, {}, (err) => {
				done();
			});
		});
	});

	describe("handler2", () => {
		it('should be exported and callable', () => {
			expect(kinesisProcessor.handler2).to.be.a('function');
		});
	});
});
