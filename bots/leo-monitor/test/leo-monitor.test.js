'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

describe("leo-monitor", () => {
	let leoMonitor;
	let loadStub;
	let loaderWriteStub;
	let loaderEndStub;
	let awsConverterStub;

	beforeEach(function () {
		loaderWriteStub = sinon.stub();
		loaderEndStub = sinon.stub();
		
		loadStub = sinon.stub().returns({
			write: loaderWriteStub,
			end: loaderEndStub
		});

		awsConverterStub = {
			unmarshall: sinon.stub().callsFake((item) => item)
		};

		const leoSdk = {
			load: loadStub,
			'@global': true
		};

		const aws = {
			DynamoDB: {
				Converter: awsConverterStub
			},
			'@global': true
		};

		process.env.SHARD_HASH_KEY = 'test-hash-key';

		leoMonitor = proxyquire('../', {
			'leo-sdk': leoSdk,
			'aws-sdk': aws
		});
	});

	afterEach(function () {
		sinon.restore();
		delete process.env.SHARD_HASH_KEY;
	});

	describe("handler", () => {
		it('should create loader with correct parameters', (done) => {
			loaderEndStub.callsFake((callback) => callback(null));

			const event = {
				Records: [{
					dynamodb: {
						ApproximateCreationDateTime: Date.now() / 1000
					}
				}]
			};

			leoMonitor.handler(event, {}, () => {
				expect(loadStub.calledWith('leo_cron_monitor', 'monitor')).to.be.true;
				done();
			});
		});

		it('should skip leo_cron_monitor bot itself', (done) => {
			loaderEndStub.callsFake((callback) => callback(null));

			awsConverterStub.unmarshall.returns({
				id: 'leo_cron_monitor'
			});

			const event = {
				Records: [{
					dynamodb: {
						ApproximateCreationDateTime: Date.now() / 1000,
						NewImage: { id: 'leo_cron_monitor' }
					}
				}]
			};

			leoMonitor.handler(event, {}, () => {
				expect(loaderWriteStub.called).to.be.false;
				done();
			});
		});

		it('should skip bots with ignoreMonitor flag', (done) => {
			loaderEndStub.callsFake((callback) => callback(null));

			awsConverterStub.unmarshall.returns({
				id: 'some-bot',
				ignoreMonitor: true
			});

			const event = {
				Records: [{
					dynamodb: {
						ApproximateCreationDateTime: Date.now() / 1000,
						NewImage: { id: 'some-bot', ignoreMonitor: true }
					}
				}]
			};

			leoMonitor.handler(event, {}, () => {
				expect(loaderWriteStub.called).to.be.false;
				done();
			});
		});

		it('should write completed event when instance completes', (done) => {
			loaderEndStub.callsFake((callback) => callback(null));

			awsConverterStub.unmarshall
				.onFirstCall().returns({
					id: 'test-bot',
					instances: {
						'instance1': {
							completedTime: 1609459300000,
							status: 'success'
						}
					}
				})
				.onSecondCall().returns({
					id: 'test-bot',
					instances: {
						'instance1': {
							invokeTime: 1609459200000
						}
					}
				});

			const event = {
				Records: [{
					dynamodb: {
						ApproximateCreationDateTime: 1609459300,
						NewImage: { id: 'test-bot' },
						OldImage: { id: 'test-bot' }
					}
				}]
			};

			leoMonitor.handler(event, {}, () => {
				expect(loaderWriteStub.calledOnce).to.be.true;
				const writeArg = loaderWriteStub.getCall(0).args[0];
				expect(writeArg.type).to.equal('completed');
				expect(writeArg.id).to.equal('test-bot');
				expect(writeArg.is_error).to.be.false;
				done();
			});
		});

		it('should write started event when instance starts', (done) => {
			loaderEndStub.callsFake((callback) => callback(null));

			awsConverterStub.unmarshall
				.onFirstCall().returns({
					id: 'test-bot',
					instances: {
						'instance1': {
							invokeTime: 1609459200000
						}
					}
				})
				.onSecondCall().returns({
					id: 'test-bot',
					instances: {}
				});

			const event = {
				Records: [{
					dynamodb: {
						ApproximateCreationDateTime: 1609459300,
						NewImage: { id: 'test-bot' },
						OldImage: { id: 'test-bot' }
					}
				}]
			};

			leoMonitor.handler(event, {}, () => {
				expect(loaderWriteStub.calledOnce).to.be.true;
				const writeArg = loaderWriteStub.getCall(0).args[0];
				expect(writeArg.type).to.equal('started');
				expect(writeArg.id).to.equal('test-bot');
				done();
			});
		});

		it('should write read checkpoint events', (done) => {
			loaderEndStub.callsFake((callback) => callback(null));

			awsConverterStub.unmarshall
				.onFirstCall().returns({
					id: 'test-bot',
					checkpoints: {
						read: {
							'test-queue': {
								checkpoint: 'z/2023/01/01/00/00/12345',
								records: 100
							}
						}
					}
				})
				.onSecondCall().returns({
					id: 'test-bot',
					checkpoints: {
						read: {
							'test-queue': {
								checkpoint: 'z/2023/01/01/00/00/12340'
							}
						}
					}
				});

			const event = {
				Records: [{
					dynamodb: {
						ApproximateCreationDateTime: 1609459300,
						NewImage: { id: 'test-bot' },
						OldImage: { id: 'test-bot' }
					}
				}]
			};

			leoMonitor.handler(event, {}, () => {
				expect(loaderWriteStub.calledOnce).to.be.true;
				const writeArg = loaderWriteStub.getCall(0).args[0];
				expect(writeArg.type).to.equal('read');
				expect(writeArg.from).to.equal('test-queue');
				expect(writeArg.units).to.equal(100);
				done();
			});
		});

		it('should write write checkpoint events', (done) => {
			loaderEndStub.callsFake((callback) => callback(null));

			awsConverterStub.unmarshall
				.onFirstCall().returns({
					id: 'test-bot',
					checkpoints: {
						write: {
							'output-queue': {
								checkpoint: 'z/2023/01/01/00/00/54321',
								records: 50
							}
						}
					}
				})
				.onSecondCall().returns({
					id: 'test-bot',
					checkpoints: {
						write: {
							'output-queue': {
								checkpoint: 'z/2023/01/01/00/00/54320'
							}
						}
					}
				});

			const event = {
				Records: [{
					dynamodb: {
						ApproximateCreationDateTime: 1609459300,
						NewImage: { id: 'test-bot' },
						OldImage: { id: 'test-bot' }
					}
				}]
			};

			leoMonitor.handler(event, {}, () => {
				expect(loaderWriteStub.calledOnce).to.be.true;
				const writeArg = loaderWriteStub.getCall(0).args[0];
				expect(writeArg.type).to.equal('write');
				expect(writeArg.to).to.equal('output-queue');
				expect(writeArg.units).to.equal(50);
				done();
			});
		});

		it('should handle records without instances', (done) => {
			loaderEndStub.callsFake((callback) => callback(null));

			awsConverterStub.unmarshall
				.onFirstCall().returns({ id: 'test-bot' })
				.onSecondCall().returns({ id: 'test-bot' });

			const event = {
				Records: [{
					dynamodb: {
						ApproximateCreationDateTime: 1609459300,
						NewImage: { id: 'test-bot' },
						OldImage: { id: 'test-bot' }
					}
				}]
			};

			leoMonitor.handler(event, {}, () => {
				expect(loaderWriteStub.called).to.be.false;
				done();
			});
		});
	});
});
