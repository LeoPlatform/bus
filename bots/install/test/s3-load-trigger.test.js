'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

describe("install/steps/s3-load-trigger", () => {
	let s3LoadTrigger;
	let addPermissionStub;
	let getBucketNotificationConfigurationStub;
	let putBucketNotificationConfigurationStub;
	let listAttachedRolePoliciesStub;
	let attachRolePolicyStub;

	beforeEach(function () {
		addPermissionStub = sinon.stub();
		getBucketNotificationConfigurationStub = sinon.stub();
		putBucketNotificationConfigurationStub = sinon.stub();
		listAttachedRolePoliciesStub = sinon.stub();
		attachRolePolicyStub = sinon.stub();

		process.env.Resources = JSON.stringify({
			LeoS3LoadTrigger: 'test-s3-trigger-function',
			LeoS3: 'test-bucket',
			LeoFirehoseRole: 'arn:aws:iam::123456789:role/test-firehose-role',
			LeoBotPolicy: 'arn:aws:iam::123456789:policy/test-bot-policy'
		});
		process.env.AWS = JSON.stringify({
			region: 'us-west-2',
			AccountId: '123456789'
		});

		const aws = {
			S3: class MockS3 {
				constructor() {
					this.getBucketNotificationConfiguration = getBucketNotificationConfigurationStub;
					this.putBucketNotificationConfiguration = putBucketNotificationConfigurationStub;
				}
			},
			Lambda: class MockLambda {
				constructor() {
					this.addPermission = addPermissionStub;
				}
			},
			IAM: class MockIAM {
				constructor() {
					this.listAttachedRolePolicies = listAttachedRolePoliciesStub;
					this.attachRolePolicy = attachRolePolicyStub;
				}
			},
			'@global': true
		};

		s3LoadTrigger = proxyquire('../steps/s3-load-trigger', {
			'aws-sdk': aws,
			'leo-logger': {
				info: sinon.stub(),
				error: sinon.stub()
			}
		});
	});

	afterEach(function () {
		sinon.restore();
		delete process.env.Resources;
		delete process.env.AWS;
	});

	describe("s3LoadTrigger", () => {
		it('should add lambda permission for S3', async () => {
			addPermissionStub.yields(null);
			getBucketNotificationConfigurationStub.yields(null, {
				LambdaFunctionConfigurations: []
			});
			putBucketNotificationConfigurationStub.yields(null);
			listAttachedRolePoliciesStub.yields(null, { AttachedPolicies: [] });
			attachRolePolicyStub.yields(null);

			await s3LoadTrigger();

			expect(addPermissionStub.calledOnce).to.be.true;
			const permissionArgs = addPermissionStub.getCall(0).args[0];
			expect(permissionArgs.FunctionName).to.equal('test-s3-trigger-function');
			expect(permissionArgs.Action).to.equal('lambda:InvokeFunction');
			expect(permissionArgs.Principal).to.equal('s3.amazonaws.com');
		});

		it('should configure S3 bucket notification', async () => {
			addPermissionStub.yields(null);
			getBucketNotificationConfigurationStub.yields(null, {
				LambdaFunctionConfigurations: []
			});
			putBucketNotificationConfigurationStub.yields(null);
			listAttachedRolePoliciesStub.yields(null, { AttachedPolicies: [] });
			attachRolePolicyStub.yields(null);

			await s3LoadTrigger();

			expect(putBucketNotificationConfigurationStub.calledOnce).to.be.true;
			const notificationArgs = putBucketNotificationConfigurationStub.getCall(0).args[0];
			expect(notificationArgs.Bucket).to.equal('test-bucket');
			
			const config = notificationArgs.NotificationConfiguration;
			const lambdaConfig = config.LambdaFunctionConfigurations.find(
				c => c.Id === 'bus-events-upload'
			);
			expect(lambdaConfig).to.not.be.undefined;
			expect(lambdaConfig.Events).to.include('s3:ObjectCreated:*');
		});

		it('should skip notification if already configured', async () => {
			addPermissionStub.yields(null);
			getBucketNotificationConfigurationStub.yields(null, {
				LambdaFunctionConfigurations: [{ Id: 'bus-events-upload' }]
			});
			listAttachedRolePoliciesStub.yields(null, { AttachedPolicies: [] });
			attachRolePolicyStub.yields(null);

			await s3LoadTrigger();

			expect(putBucketNotificationConfigurationStub.called).to.be.false;
		});

		it('should attach bot policy to firehose role', async () => {
			addPermissionStub.yields(null);
			getBucketNotificationConfigurationStub.yields(null, {
				LambdaFunctionConfigurations: [{ Id: 'bus-events-upload' }]
			});
			listAttachedRolePoliciesStub.yields(null, { AttachedPolicies: [] });
			attachRolePolicyStub.yields(null);

			await s3LoadTrigger();

			expect(attachRolePolicyStub.calledOnce).to.be.true;
			const attachArgs = attachRolePolicyStub.getCall(0).args[0];
			expect(attachArgs.PolicyArn).to.equal('arn:aws:iam::123456789:policy/test-bot-policy');
			expect(attachArgs.RoleName).to.equal('test-firehose-role');
		});

		it('should skip policy attachment if already attached', async () => {
			addPermissionStub.yields(null);
			getBucketNotificationConfigurationStub.yields(null, {
				LambdaFunctionConfigurations: [{ Id: 'bus-events-upload' }]
			});
			listAttachedRolePoliciesStub.yields(null, {
				AttachedPolicies: [{ PolicyArn: 'arn:aws:iam::123456789:policy/test-bot-policy' }]
			});

			await s3LoadTrigger();

			expect(attachRolePolicyStub.called).to.be.false;
		});

		it('should handle permission already exists error', async () => {
			const permissionError = new Error('The statement id (S3-bus-events-upload-trigger) provided already exists');
			addPermissionStub.yields(permissionError);
			getBucketNotificationConfigurationStub.yields(null, {
				LambdaFunctionConfigurations: []
			});
			putBucketNotificationConfigurationStub.yields(null);
			listAttachedRolePoliciesStub.yields(null, { AttachedPolicies: [] });
			attachRolePolicyStub.yields(null);

			await s3LoadTrigger();

			// Should not throw, should continue
			expect(getBucketNotificationConfigurationStub.calledOnce).to.be.true;
		});

		it('should reject on addPermission error (non-duplicate)', async () => {
			addPermissionStub.yields(new Error('Permission error'));

			try {
				await s3LoadTrigger();
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err.message).to.equal('Permission error');
			}
		});

		it('should reject on getBucketNotificationConfiguration error', async () => {
			addPermissionStub.yields(null);
			getBucketNotificationConfigurationStub.yields(new Error('Get notification error'));
			listAttachedRolePoliciesStub.yields(null, { AttachedPolicies: [] });
			attachRolePolicyStub.yields(null);

			try {
				await s3LoadTrigger();
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err.message).to.equal('Get notification error');
			}
		});

		it('should reject on putBucketNotificationConfiguration error', async () => {
			addPermissionStub.yields(null);
			getBucketNotificationConfigurationStub.yields(null, {
				LambdaFunctionConfigurations: []
			});
			putBucketNotificationConfigurationStub.yields(new Error('Put notification error'));
			listAttachedRolePoliciesStub.yields(null, { AttachedPolicies: [] });
			attachRolePolicyStub.yields(null);

			try {
				await s3LoadTrigger();
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err.message).to.equal('Put notification error');
			}
		});

		it('should reject on listAttachedRolePolicies error', async () => {
			addPermissionStub.yields(null);
			getBucketNotificationConfigurationStub.yields(null, {
				LambdaFunctionConfigurations: [{ Id: 'bus-events-upload' }]
			});
			listAttachedRolePoliciesStub.yields(new Error('List policies error'));

			try {
				await s3LoadTrigger();
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err.message).to.equal('List policies error');
			}
		});

		it('should reject on attachRolePolicy error', async () => {
			addPermissionStub.yields(null);
			getBucketNotificationConfigurationStub.yields(null, {
				LambdaFunctionConfigurations: [{ Id: 'bus-events-upload' }]
			});
			listAttachedRolePoliciesStub.yields(null, { AttachedPolicies: [] });
			attachRolePolicyStub.yields(new Error('Attach policy error'));

			try {
				await s3LoadTrigger();
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err.message).to.equal('Attach policy error');
			}
		});

		it('should configure filter for firehose prefix', async () => {
			addPermissionStub.yields(null);
			getBucketNotificationConfigurationStub.yields(null, {
				LambdaFunctionConfigurations: []
			});
			putBucketNotificationConfigurationStub.yields(null);
			listAttachedRolePoliciesStub.yields(null, { AttachedPolicies: [] });
			attachRolePolicyStub.yields(null);

			await s3LoadTrigger();

			const notificationArgs = putBucketNotificationConfigurationStub.getCall(0).args[0];
			const lambdaConfig = notificationArgs.NotificationConfiguration.LambdaFunctionConfigurations.find(
				c => c.Id === 'bus-events-upload'
			);
			
			expect(lambdaConfig.Filter.Key.FilterRules).to.deep.include({
				Name: 'prefix',
				Value: 'firehose/'
			});
		});
	});
});
