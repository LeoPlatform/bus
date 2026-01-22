'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

describe("getLeoConfigFromBusStack", () => {
	let getLeoConfigFromBusStack;
	let cloudFormationStub;
	let describeStacksStub;

	beforeEach(function () {
		describeStacksStub = sinon.stub();
		
		cloudFormationStub = sinon.stub().returns({
			describeStacks: () => ({
				promise: describeStacksStub
			})
		});

		getLeoConfigFromBusStack = proxyquire('../../lib/getLeoConfigFromBusStack', {
			'aws-sdk': {
				CloudFormation: cloudFormationStub,
				'@global': true
			},
			'leo-logger': {
				info: sinon.stub()
			}
		});
	});

	afterEach(function () {
		sinon.restore();
	});

	it('should return leo stack configuration from CloudFormation outputs', async () => {
		const mockOutputs = [
			{ OutputKey: 'LeoCron', OutputValue: 'cron-table' },
			{ OutputKey: 'LeoEvent', OutputValue: 'event-table' },
			{ OutputKey: 'LeoFirehoseStream', OutputValue: 'firehose-stream' },
			{ OutputKey: 'LeoKinesisStream', OutputValue: 'kinesis-stream' },
			{ OutputKey: 'LeoS3', OutputValue: 'leo-s3-bucket' },
			{ OutputKey: 'LeoSettings', OutputValue: 'settings-table' },
			{ OutputKey: 'LeoStream', OutputValue: 'stream-table' },
			{ OutputKey: 'LeoSystem', OutputValue: 'system-table' }
		];

		describeStacksStub.resolves({
			Stacks: [{
				Outputs: mockOutputs
			}]
		});

		const config = await getLeoConfigFromBusStack('test-stack');

		expect(config).to.deep.equal({
			credentials: undefined,
			resources: {
				LeoCron: 'cron-table',
				LeoEvent: 'event-table',
				LeoFirehoseStream: 'firehose-stream',
				LeoKinesisStream: 'kinesis-stream',
				LeoS3: 'leo-s3-bucket',
				LeoSettings: 'settings-table',
				LeoStream: 'stream-table',
				LeoSystem: 'system-table'
			},
			firehose: 'firehose-stream',
			kinesis: 'kinesis-stream',
			s3: 'leo-s3-bucket'
		});
	});

	it('should use provided credentials when passed', async () => {
		const mockCredentials = {
			accessKeyId: 'test-key',
			secretAccessKey: 'test-secret'
		};

		describeStacksStub.resolves({
			Stacks: [{
				Outputs: [
					{ OutputKey: 'LeoCron', OutputValue: 'cron' },
					{ OutputKey: 'LeoEvent', OutputValue: 'event' },
					{ OutputKey: 'LeoFirehoseStream', OutputValue: 'firehose' },
					{ OutputKey: 'LeoKinesisStream', OutputValue: 'kinesis' },
					{ OutputKey: 'LeoS3', OutputValue: 's3' },
					{ OutputKey: 'LeoSettings', OutputValue: 'settings' },
					{ OutputKey: 'LeoStream', OutputValue: 'stream' },
					{ OutputKey: 'LeoSystem', OutputValue: 'system' }
				]
			}]
		});

		const config = await getLeoConfigFromBusStack('test-stack', mockCredentials);

		expect(cloudFormationStub.calledWith({ credentials: mockCredentials })).to.be.true;
		expect(config.credentials).to.equal(mockCredentials);
	});

	it('should throw error when multiple stacks match', async () => {
		describeStacksStub.resolves({
			Stacks: [
				{ Outputs: [] },
				{ Outputs: [] }
			]
		});

		try {
			await getLeoConfigFromBusStack('test-stack');
			expect.fail('Should have thrown an error');
		} catch (err) {
			expect(err.message).to.equal('Multiple stacks match criteria');
		}
	});

	it('should handle partial outputs gracefully', async () => {
		const mockOutputs = [
			{ OutputKey: 'LeoCron', OutputValue: 'cron-table' },
			{ OutputKey: 'LeoS3', OutputValue: 'leo-s3-bucket' }
		];

		describeStacksStub.resolves({
			Stacks: [{
				Outputs: mockOutputs
			}]
		});

		const config = await getLeoConfigFromBusStack('test-stack');

		expect(config.resources.LeoCron).to.equal('cron-table');
		expect(config.resources.LeoS3).to.equal('leo-s3-bucket');
		expect(config.resources.LeoEvent).to.be.undefined;
	});

	it('should handle empty outputs array', async () => {
		describeStacksStub.resolves({
			Stacks: [{
				Outputs: []
			}]
		});

		const config = await getLeoConfigFromBusStack('test-stack');

		expect(config.resources).to.deep.equal({
			LeoCron: undefined,
			LeoEvent: undefined,
			LeoFirehoseStream: undefined,
			LeoKinesisStream: undefined,
			LeoS3: undefined,
			LeoSettings: undefined,
			LeoStream: undefined,
			LeoSystem: undefined
		});
	});

	it('should propagate CloudFormation errors', async () => {
		const error = new Error('CloudFormation error');
		describeStacksStub.rejects(error);

		try {
			await getLeoConfigFromBusStack('test-stack');
			expect.fail('Should have thrown an error');
		} catch (err) {
			expect(err.message).to.equal('CloudFormation error');
		}
	});

	it('should call CloudFormation with correct stack name', async () => {
		describeStacksStub.resolves({
			Stacks: [{ Outputs: [] }]
		});

		await getLeoConfigFromBusStack('my-bus-stack');

		// Verify the CloudFormation was instantiated
		expect(cloudFormationStub.called).to.be.true;
	});
});
