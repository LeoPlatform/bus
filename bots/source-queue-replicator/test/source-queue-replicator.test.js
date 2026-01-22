'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

describe("source-queue-replicator", () => {
	let sourceQueueReplicator;
	let stsAssumeRoleStub;
	let stsCredentialsFromStub;
	let getLeoConfigStub;
	let readStub;
	let loadStub;
	let pipeStub;
	let statsStub;
	let checkpointStub;

	beforeEach(function () {
		stsAssumeRoleStub = sinon.stub();
		stsCredentialsFromStub = sinon.stub();
		getLeoConfigStub = sinon.stub();
		readStub = sinon.stub();
		loadStub = sinon.stub();
		pipeStub = sinon.stub();
		checkpointStub = sinon.stub();
		
		statsStub = sinon.stub().returns({
			checkpoint: checkpointStub
		});

		const AWS = {
			STS: class MockSTS {
				constructor() {
					this.assumeRole = stsAssumeRoleStub;
					this.credentialsFrom = stsCredentialsFromStub;
				}
			},
			'@global': true
		};

		const leoSdk = {
			read: readStub,
			streams: {
				stats: statsStub,
				pipe: pipeStub
			},
			'@global': true
		};

		// Mock leo-sdk as a callable function that returns sdk with load
		const leoSdkCallable = function(config) {
			return { load: loadStub };
		};
		leoSdkCallable.read = readStub;
		leoSdkCallable.streams = { stats: statsStub, pipe: pipeStub };
		leoSdkCallable['@global'] = true;

		const cronWrapper = (handler) => handler;
		cronWrapper['@global'] = true;

		const loggerMock = {
			info: sinon.stub(),
			error: sinon.stub()
		};

		sourceQueueReplicator = proxyquire('../', {
			'aws-sdk': AWS,
			'leo-sdk': leoSdkCallable,
			'leo-sdk/wrappers/cron': cronWrapper,
			'../../lib/getLeoConfigFromBusStack': getLeoConfigStub,
			'leo-logger': loggerMock
		});
	});

	afterEach(function () {
		sinon.restore();
	});

	describe("handler", () => {
		const mockEvent = {
			botId: 'test-replicator',
			sourceQueue: 'source-queue',
			destinationQueue: 'dest-queue',
			destinationBusStack: 'dest-stack',
			destinationLeoBotRoleArn: 'arn:aws:iam::123456789:role/dest-role'
		};

		const mockContext = {
			getRemainingTimeInMillis: () => 300000
		};

		it('should handle STS assume role errors', (done) => {
			stsAssumeRoleStub.callsFake((params, callback) => {
				callback(new Error('Access denied'));
			});

			sourceQueueReplicator.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('Access denied');
				done();
			});
		});

		it('should call assumeRole with correct parameters', (done) => {
			stsAssumeRoleStub.callsFake((params, callback) => {
				expect(params.RoleArn).to.equal(mockEvent.destinationLeoBotRoleArn);
				expect(params.RoleSessionName).to.equal('SourceQueueReplicator');
				expect(params.DurationSeconds).to.equal(900);
				callback(new Error('Stop here'));
			});

			sourceQueueReplicator.handler(mockEvent, mockContext, (err) => {
				expect(stsAssumeRoleStub.calledOnce).to.be.true;
				done();
			});
		});

		it('should handle getLeoConfig errors', (done) => {
			const mockCredentials = { accessKeyId: 'test' };
			
			stsAssumeRoleStub.callsFake((params, callback) => {
				callback(null, { Credentials: mockCredentials });
			});

			stsCredentialsFromStub.returns(mockCredentials);

			getLeoConfigStub.rejects(new Error('Stack not found'));

			sourceQueueReplicator.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('Stack not found');
				done();
			});
		});

		it('should get credentials from STS response', (done) => {
			const mockCredentials = { accessKeyId: 'test', secretAccessKey: 'secret' };
			
			stsAssumeRoleStub.callsFake((params, callback) => {
				callback(null, { Credentials: mockCredentials });
			});

			stsCredentialsFromStub.callsFake((data) => {
				expect(data.Credentials).to.equal(mockCredentials);
				return mockCredentials;
			});

			getLeoConfigStub.rejects(new Error('Stop after credentials'));

			sourceQueueReplicator.handler(mockEvent, mockContext, (err) => {
				expect(stsCredentialsFromStub.calledOnce).to.be.true;
				done();
			});
		});

		it('should call getLeoConfig with stack name and credentials', (done) => {
			const mockCredentials = { accessKeyId: 'test' };
			
			stsAssumeRoleStub.callsFake((params, callback) => {
				callback(null, { Credentials: {} });
			});

			stsCredentialsFromStub.returns(mockCredentials);

			getLeoConfigStub.callsFake((stackName, credentials) => {
				expect(stackName).to.equal(mockEvent.destinationBusStack);
				expect(credentials).to.equal(mockCredentials);
				return Promise.reject(new Error('Stop here'));
			});

			sourceQueueReplicator.handler(mockEvent, mockContext, (err) => {
				expect(getLeoConfigStub.calledOnce).to.be.true;
				done();
			});
		});

		it('should replicate data from source to destination on success', (done) => {
			const mockCredentials = { accessKeyId: 'test' };
			
			stsAssumeRoleStub.callsFake((params, callback) => {
				callback(null, { Credentials: {} });
			});

			stsCredentialsFromStub.returns(mockCredentials);
			getLeoConfigStub.resolves({ resources: {} });

			const mockReadStream = { pipe: sinon.stub() };
			const mockLoadStream = {};
			
			readStub.returns(mockReadStream);
			loadStub.returns(mockLoadStream);

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				callback(null);
			});

			checkpointStub.callsFake((callback) => callback(null));

			sourceQueueReplicator.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.null;
				expect(readStub.calledWith(mockEvent.botId, mockEvent.sourceQueue)).to.be.true;
				expect(loadStub.calledWith(mockEvent.botId, mockEvent.destinationQueue)).to.be.true;
				done();
			});
		});

		it('should handle pipe errors', (done) => {
			const mockCredentials = { accessKeyId: 'test' };
			
			stsAssumeRoleStub.callsFake((params, callback) => {
				callback(null, { Credentials: {} });
			});

			stsCredentialsFromStub.returns(mockCredentials);
			getLeoConfigStub.resolves({ resources: {} });

			readStub.returns({});
			loadStub.returns({});

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				callback(new Error('Pipe failed'));
			});

			sourceQueueReplicator.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('Pipe failed');
				done();
			});
		});

		it('should checkpoint after successful replication', (done) => {
			const mockCredentials = { accessKeyId: 'test' };
			
			stsAssumeRoleStub.callsFake((params, callback) => {
				callback(null, { Credentials: {} });
			});

			stsCredentialsFromStub.returns(mockCredentials);
			getLeoConfigStub.resolves({ resources: {} });

			readStub.returns({});
			loadStub.returns({});

			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				callback(null);
			});

			checkpointStub.callsFake((callback) => {
				callback(null);
			});

			sourceQueueReplicator.handler(mockEvent, mockContext, (err) => {
				expect(err).to.be.null;
				expect(checkpointStub.calledOnce).to.be.true;
				done();
			});
		});
	});
});
