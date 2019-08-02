"use strict";
const aws = require("aws-sdk");
const logger = require("leo-logger");

module.exports = function() {
	return Promise.all([new Promise((resolve, reject) => {
		const leo = {
			resources: JSON.parse(process.env.Resources),
			aws: JSON.parse(process.env.AWS)
		};
		var s3 = new aws.S3({
			region: leo.aws.region
		});
		var lambda = new aws.Lambda({
			region: leo.aws.region
		});
		logger.info(leo.resources, leo.aws);
		var functionName = leo.resources.LeoS3LoadTrigger;
		var bucket = leo.resources.LeoS3;
		var accountId = leo.aws.AccountId;

		lambda.addPermission({
			Action: "lambda:InvokeFunction",
			FunctionName: functionName,
			Principal: "s3.amazonaws.com",
			SourceAccount: accountId,
			SourceArn: `arn:aws:s3:::${bucket}`,
			StatementId: "S3-bus-events-upload-trigger"
		}, (err) => {
			if (err && !err.message.startsWith("The statement id (S3-bus-events-upload-trigger) provided already exists")) {
				reject(err);
				return;
			}
			s3.getBucketNotificationConfiguration({
				Bucket: bucket
			}, (err, data) => {
				if (err) {
					logger.error(err);
					reject(err);
					return;
				}
				logger.info(data);
				var exists = data.LambdaFunctionConfigurations.filter(c => c.Id == "bus-events-upload").length != 0;
				if (!exists) {
					data.LambdaFunctionConfigurations.push({
						Id: "bus-events-upload",
						Events: ["s3:ObjectCreated:*"],
						LambdaFunctionArn: `arn:aws:lambda:${leo.aws.region}:${accountId}:function:${functionName}`,
						Filter: {
							Key: {
								FilterRules: [{
									Name: "prefix",
									Value: "firehose/"
								}]
							}
						}
					});
					logger.info(JSON.stringify(data, null, 2));
					s3.putBucketNotificationConfiguration({
						Bucket: bucket,
						NotificationConfiguration: data
					}, (err, result) => {
						logger.error(err, result);
						if (err) {
							reject(err);
						} else {
							resolve();
						}
					});
				} else {
					resolve();
				}
			});
		});
	}), new Promise((resolve, reject) => {
		const leo = {
			resources: JSON.parse(process.env.Resources),
			aws: JSON.parse(process.env.AWS)
		};
		var iam = new aws.IAM({
			region: leo.aws.region
		});

		var roleName = leo.resources.LeoFirehoseRole.replace(/arn:aws:iam::.*?:role\//, "");
		iam.listAttachedRolePolicies({
			RoleName: roleName
		}, (err, policies) => {
			if (err) {
				logger.error(err);
				reject(err);
				return;
			}
			logger.info("Policies", policies);
			var arn = leo.resources.LeoBotPolicy;
			if (policies.AttachedPolicies.filter(p => p.PolicyArn == arn).length == 0) {
				iam.attachRolePolicy({ // TODO: Why are we manually doing this? can't this be done in cloudformation? this prevents the stacks from deleting cleanly. If this is needed perhpas we should respond to the 'Delete' event by removing this resource.
					PolicyArn: arn,
					RoleName: roleName
				}, (err, result) => {
					logger.info("Add Managed Bot To FirehoseRole", result);
					if (err) {
						logger.error(err);
						reject(err);
					} else {
						resolve();
					}
				});
			} else {
				resolve();
			}
		});
	})]);
};
