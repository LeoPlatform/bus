'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

describe("Install bot", function() {
	let installBot;
	let addPermissionFunc;
	let getBucketNotificationConfigurationFunc;
	let listAttachedRolePoliciesFunc;
	let putBucketNotificationConfigurationFunc;
	let attachRolePolicyFunc;
	let sendCustomResourceResponseFunc;

	before(function () {
		process.env.Resources = "{ \"LeoFirehoseRole\": \"FOOBARD\" }";
		process.env.AWS = "{}";

		addPermissionFunc = sinon.stub();
		getBucketNotificationConfigurationFunc = sinon.stub();
		listAttachedRolePoliciesFunc = sinon.stub();
		putBucketNotificationConfigurationFunc = sinon.stub();
		attachRolePolicyFunc = sinon.stub();
		sendCustomResourceResponseFunc = sinon.stub();

		const leoSdk = {
			bot: {
				createBot: () => Promise.resolve()
			},
			configuration: {
				resources: {
					LeoFirehoseStreamProcessor: "foo"
				}
			},
			'@global': true
		};
		const AWS = {
			S3: class S3 {	
				constructor(){
					this.getBucketNotificationConfiguration = getBucketNotificationConfigurationFunc;
					this.putBucketNotificationConfiguration = putBucketNotificationConfigurationFunc;
				}	
			},
			IAM: class IAM {
				constructor(){
					this.listAttachedRolePolicies = listAttachedRolePoliciesFunc;
					this.attachRolePolicy = attachRolePolicyFunc;
				}	
			},
			Lambda: class Lambda {
				constructor(){
					this.addPermission = addPermissionFunc;
				}	
			},
			'@global': true
		};

		installBot = proxyquire('../', {
			'aws-sdk': AWS,
			'leo-sdk': leoSdk,
			'../../lib/sendCustomResourceResponse': sendCustomResourceResponseFunc
		});
	});

	after(function () {
	});

	it("Succeeds", function(done) {
		addPermissionFunc.yields();
		sendCustomResourceResponseFunc.resolves({
			Status: "SUCCESS"
		});

		getBucketNotificationConfigurationFunc.yields(null, {
			LambdaFunctionConfigurations: []
		});
		listAttachedRolePoliciesFunc.yields(null, {
			AttachedPolicies: []
		});
		putBucketNotificationConfigurationFunc.yields();
		attachRolePolicyFunc.yields(null, "attachrole result");
		
		const event = {
			ResponseURL: 'http://localhost',
			PhysicalResourceId: 'physicalresourceid',
			StackId: 'stackid',
			RequestId: 'requestid',
			LogicalResourceId: 'logicalresourceid',
			ResourceProperties: {}
		};
		
		installBot.handler(event, {}, (err, result) => {
			expect(result.Status).to.be.equal("SUCCESS");
			done(err);
		} );
	});
});
