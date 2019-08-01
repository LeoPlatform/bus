module.exports = {
	Resources: {
		"LeoS3": {
			"Type": "AWS::S3::Bucket",
			"Properties": {}
		},
		"LeoDeveloperGroup": {
			"Type": "AWS::IAM::Group",
			"Properties": {
				"ManagedPolicyArns": [
					{
						"Ref": "LeoBotPolicy"
					}
				],
				"Policies": []
			}
		},
		"LeoCronSchedulerRule": {
			"Type": "AWS::Events::Rule",
			"Properties": {
				"Description": "Leo Cron Scheduler Rule",
				"ScheduleExpression": "rate(5 minutes)",
				"State": "ENABLED",
				"Targets": [
					{
						"Arn": {
							"Fn::Sub": "${LeoCronScheduler.Arn}"
						},
						"Id": "LeoCronSchedulerRule"
					}
				]
			}
		},
	}
};
