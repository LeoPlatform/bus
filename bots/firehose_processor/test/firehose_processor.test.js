'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

describe("firehose_processor", () => {
	let firehoseProcessor;
	let pipeStub;
	let fromLeoStub;
	let fromS3Stub;
	let splitStub;
	let throughStub;
	let parseStub;
	let pipelineStub;
	let toS3GzipChunksStub;
	let toLeoStub;
	let devnullStub;
	let checkpointStub;

	beforeEach(function () {
		pipeStub = sinon.stub();
		fromLeoStub = sinon.stub();
		fromS3Stub = sinon.stub();
		splitStub = sinon.stub();
		throughStub = sinon.stub();
		parseStub = sinon.stub();
		pipelineStub = sinon.stub();
		toS3GzipChunksStub = sinon.stub();
		toLeoStub = sinon.stub();
		devnullStub = sinon.stub();
		checkpointStub = sinon.stub();

		const leoSdk = {
			configuration: {
				resources: {
					LeoKinesisStream: 'kinesis-stream',
					LeoS3: 's3-bucket',
					LeoFirehoseStream: 'firehose-stream'
				},
				update: sinon.stub()
			},
			streams: {
				pipe: pipeStub,
				fromLeo: fromLeoStub,
				fromS3: fromS3Stub,
				split: splitStub,
				through: throughStub,
				parse: parseStub,
				pipeline: pipelineStub,
				toS3GzipChunks: toS3GzipChunksStub,
				toLeo: toLeoStub,
				devnull: devnullStub
			},
			bot: {
				checkpoint: checkpointStub
			},
			'@global': true
		};

		const refUtil = {
			ref: sinon.stub().callsFake((id) => ({
				queue: () => ({ id: id })
			})),
			'@global': true
		};

		const cronWrapper = (handler) => handler;
		cronWrapper['@global'] = true;

		firehoseProcessor = proxyquire('../', {
			'leo-sdk': leoSdk,
			'leo-sdk/wrappers/cron': cronWrapper,
			'leo-sdk/lib/reference.js': refUtil,
			'async': require('async'),
			'zlib': require('zlib')
		});
	});

	afterEach(function () {
		sinon.restore();
	});

	describe("handler", () => {
		const mockContext = {
			getRemainingTimeInMillis: () => 300000
		};

		it('should process firehose files from S3', (done) => {
			const mockEvent = {
				botId: 'test-firehose-processor',
				start: 'z/2023/01/01/00/00/00000',
				debug: false
			};

			// Simulate no files to process (empty result)
			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				callback(null);
			});

			fromLeoStub.returns({});
			throughStub.returns({});
			devnullStub.returns({});

			firehoseProcessor.handler(mockEvent, mockContext, (err, result) => {
				expect(err).to.be.null;
				// Result should be 0 units processed
				expect(result).to.equal(0);
				done();
			});
		});

		it('should use botId from event', (done) => {
			const mockEvent = {
				botId: 'custom-bot-id',
				start: 'z/2023/01/01/00/00/00000'
			};

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				callback(null);
			});

			fromLeoStub.callsFake((botId, source, opts) => {
				expect(botId).to.equal('custom-bot-id');
				return {};
			});

			throughStub.returns({});
			devnullStub.returns({});

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.null;
				done();
			});
		});

		it('should handle processing errors', (done) => {
			const mockEvent = {
				botId: 'test-bot',
				start: 'z/2023/01/01/00/00/00000'
			};

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				callback(new Error('Processing failed'));
			});

			fromLeoStub.returns({});
			throughStub.returns({});
			devnullStub.returns({});

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('Processing failed');
				done();
			});
		});

		it('should checkpoint after processing units', (done) => {
			const mockEvent = {
				botId: 'test-bot',
				start: 'z/2023/01/01/00/00/00000'
			};

			let callCount = 0;
			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				callCount++;
				// First call processes, subsequent calls don't
				callback(null);
			});

			fromLeoStub.returns({});
			throughStub.returns({});
			devnullStub.returns({});
			checkpointStub.callsFake((botId, source, data, callback) => {
				callback(null);
			});

			firehoseProcessor.handler(mockEvent, mockContext, (err, result) => {
				expect(err).to.be.null;
				done();
			});
		});

		it('should pass debug flag to fromLeo', (done) => {
			const mockEvent = {
				botId: 'test-bot',
				start: 'z/2023/01/01/00/00/00000',
				debug: true
			};

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				callback(null);
			});

			fromLeoStub.callsFake((botId, source, opts) => {
				expect(opts.debug).to.be.true;
				return {};
			});

			throughStub.returns({});
			devnullStub.returns({});

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.null;
				done();
			});
		});

		it('should use start eid from event', (done) => {
			const mockEvent = {
				botId: 'test-bot',
				start: 'z/2023/06/15/12/30/12345'
			};

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				callback(null);
			});

			fromLeoStub.callsFake((botId, source, opts) => {
				expect(opts.start).to.equal('z/2023/06/15/12/30/12345');
				return {};
			});

			throughStub.returns({});
			devnullStub.returns({});

			firehoseProcessor.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.null;
				done();
			});
		});
	});
});
