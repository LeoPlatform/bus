'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

describe("archive", () => {
	let archiveHandler;
	let dynamodbScanStub;
	let readStub;
	let pipeStub;
	let counterStub;
	let toS3GzipChunksStub;
	let toLeoStub;
	let devnullStub;
	let logStub;
	let infoStub;
	let errorStub;

	const mockEventTable = 'test-event-table';

	beforeEach(function () {
		dynamodbScanStub = sinon.stub();
		readStub = sinon.stub();
		pipeStub = sinon.stub();
		counterStub = sinon.stub().returns({});
		toS3GzipChunksStub = sinon.stub().returns({});
		toLeoStub = sinon.stub().returns({});
		devnullStub = sinon.stub().returns({});
		logStub = sinon.stub();
		infoStub = sinon.stub();
		errorStub = sinon.stub();

		const leoSdk = {
			configuration: {
				resources: {
					LeoEvent: mockEventTable
				}
			},
			aws: {
				dynamodb: {
					scan: dynamodbScanStub
				}
			},
			streams: {
				pipe: pipeStub,
				counter: counterStub,
				toS3GzipChunks: toS3GzipChunksStub,
				toLeo: toLeoStub,
				devnull: devnullStub
			},
			read: readStub,
			'@global': true
		};

		// Mock the cron wrapper to just pass through the handler
		const cronWrapper = (handler) => handler;
		cronWrapper['@global'] = true;

		const loggerMock = () => ({
			log: logStub,
			info: infoStub,
			error: errorStub
		});
		loggerMock['@global'] = true;

		archiveHandler = proxyquire('../', {
			'leo-sdk': leoSdk,
			'leo-sdk/wrappers/cron': cronWrapper,
			'async': require('async'),
			'moment': require('moment'),
			'leo-logger': loggerMock
		}).handler;
	});

	afterEach(function () {
		sinon.restore();
	});

	describe("handler", () => {
		const mockContext = {
			getRemainingTimeInMillis: () => 300000 // 5 minutes
		};

		it('should scan event table for queues to archive', (done) => {
			dynamodbScanStub.callsFake((table, opts, callback) => {
				expect(table).to.equal(mockEventTable);
				callback(null, []);
			});

			archiveHandler({}, mockContext, (err) => {
				expect(err).to.be.null;
				expect(dynamodbScanStub.calledOnce).to.be.true;
				done();
			});
		});

		it('should skip queues with skip_archive flag', (done) => {
			dynamodbScanStub.callsFake((table, opts, callback) => {
				callback(null, [{
					event: 'test-queue',
					skip_archive: true,
					max_eid: 'z/2023/01/01/00/00/12345'
				}]);
			});

			archiveHandler({}, mockContext, (err) => {
				expect(err).to.be.null;
				expect(pipeStub.called).to.be.false;
				done();
			});
		});

		it('should skip snapshot queues', (done) => {
			dynamodbScanStub.callsFake((table, opts, callback) => {
				callback(null, [{
					event: 'test-queue/_snapshot',
					max_eid: 'z/2023/01/01/00/00/12345'
				}]);
			});

			archiveHandler({}, mockContext, (err) => {
				expect(err).to.be.null;
				expect(pipeStub.called).to.be.false;
				done();
			});
		});

		it('should skip archive queues', (done) => {
			dynamodbScanStub.callsFake((table, opts, callback) => {
				callback(null, [{
					event: 'test-queue/_archive',
					max_eid: 'z/2023/01/01/00/00/12345'
				}]);
			});

			archiveHandler({}, mockContext, (err) => {
				expect(err).to.be.null;
				expect(pipeStub.called).to.be.false;
				done();
			});
		});

		it('should skip queues without max_eid', (done) => {
			dynamodbScanStub.callsFake((table, opts, callback) => {
				callback(null, [{
					event: 'test-queue'
				}]);
			});

			archiveHandler({}, mockContext, (err) => {
				expect(err).to.be.null;
				expect(pipeStub.called).to.be.false;
				done();
			});
		});

		it('should archive queues that need archiving', (done) => {
			dynamodbScanStub.callsFake((table, opts, callback) => {
				callback(null, [{
					event: 'test-queue',
					max_eid: 'z/2023/12/31/23/59/99999',
					archive: {
						end: 'z/2020/01/01/00/00/00000'
					}
				}]);
			});

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				callback(null);
			});

			readStub.returns({});

			archiveHandler({}, mockContext, (err) => {
				expect(err).to.be.null;
				expect(pipeStub.calledOnce).to.be.true;
				done();
			});
		});

		it('should handle pipe errors', (done) => {
			dynamodbScanStub.callsFake((table, opts, callback) => {
				callback(null, [{
					event: 'test-queue',
					max_eid: 'z/2023/12/31/23/59/99999',
					archive: { end: 'z/2020/01/01/00/00/00000' }
				}]);
			});

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				callback(new Error('Pipe error'));
			});

			readStub.returns({});

			archiveHandler({}, mockContext, (err) => {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('Pipe error');
				done();
			});
		});
	});
});
