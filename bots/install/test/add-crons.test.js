'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

describe("install/steps/add-crons", () => {
	let addCrons;
	let createBotStub;

	beforeEach(function () {
		createBotStub = sinon.stub();

		const leoSdk = {
			bot: {
				createBot: createBotStub
			},
			configuration: {
				resources: {
					LeoFirehoseStreamProcessor: 'test-firehose-processor'
				}
			},
			'@global': true
		};

		const monitorPackageJson = {
			config: {
				leo: {
					cron: {
						lambdaName: 'monitor-lambda',
						time: '* * * * * *'
					}
				}
			}
		};

		const firehosePackageJson = {
			config: {
				leo: {
					cron: {
						lambdaName: 'firehose-lambda',
						time: '* * * * * *'
					}
				}
			}
		};

		addCrons = proxyquire('../steps/add-crons', {
			'leo-sdk': leoSdk,
			'../../leo-monitor/package.json': monitorPackageJson,
			'../../firehose_processor/package.json': firehosePackageJson
		});
	});

	afterEach(function () {
		sinon.restore();
	});

	describe("addCrons", () => {
		it('should create leo_cron_monitor bot', async () => {
			createBotStub.resolves({ success: true });

			await addCrons();

			expect(createBotStub.calledWith('leo_cron_monitor')).to.be.true;
		});

		it('should create firehose processor bot', async () => {
			createBotStub.resolves({ success: true });

			await addCrons();

			expect(createBotStub.calledWith('test-firehose-processor')).to.be.true;
		});

		it('should pass monitor config to createBot', async () => {
			createBotStub.resolves({ success: true });

			await addCrons();

			const monitorCall = createBotStub.getCalls().find(
				call => call.args[0] === 'leo_cron_monitor'
			);
			expect(monitorCall).to.not.be.undefined;
			expect(monitorCall.args[1]).to.have.property('lambdaName', 'monitor-lambda');
		});

		it('should pass firehose config to createBot', async () => {
			createBotStub.resolves({ success: true });

			await addCrons();

			const firehoseCall = createBotStub.getCalls().find(
				call => call.args[0] === 'test-firehose-processor'
			);
			expect(firehoseCall).to.not.be.undefined;
			expect(firehoseCall.args[1]).to.have.property('lambdaName', 'firehose-lambda');
		});

		it('should reject if monitor bot creation fails', async () => {
			createBotStub.onFirstCall().rejects(new Error('Monitor creation failed'));
			createBotStub.onSecondCall().resolves({ success: true });

			try {
				await addCrons();
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err.message).to.equal('Monitor creation failed');
			}
		});

		it('should reject if firehose bot creation fails', async () => {
			createBotStub.onFirstCall().resolves({ success: true });
			createBotStub.onSecondCall().rejects(new Error('Firehose creation failed'));

			try {
				await addCrons();
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err.message).to.equal('Firehose creation failed');
			}
		});

		it('should create both bots in parallel', async () => {
			const callOrder = [];
			createBotStub.callsFake((id) => {
				callOrder.push(id);
				return Promise.resolve({ success: true });
			});

			await addCrons();

			// Both bots should be created
			expect(createBotStub.callCount).to.equal(2);
			expect(callOrder).to.include('leo_cron_monitor');
			expect(callOrder).to.include('test-firehose-processor');
		});
	});
});
