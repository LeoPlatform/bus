module.exports = {
	Resources: {
		"LeoEventMapping": {
			"Type": "AWS::Lambda::EventSourceMapping",
			"Properties": {
				"BatchSize": 500,
				"Enabled": true,
				"StartingPosition": "TRIM_HORIZON",
				"EventSourceArn": {
					"Fn::Sub": "${LeoEvent.StreamArn}"
				},
				"FunctionName": {
					"Ref": "LeoEventTrigger"
				}
			}
		},
		"LeoCronMapping": {
			"Type": "AWS::Lambda::EventSourceMapping",
			"Properties": {
				"BatchSize": 500,
				"Enabled": true,
				"StartingPosition": "TRIM_HORIZON",
				"EventSourceArn": {
					"Fn::Sub": "${LeoCron.StreamArn}"
				},
				"FunctionName": {
					"Ref": "LeoCronProcessor"
				}
			},
			"DependsOn": [
				"LeoCronRole"
			]
		},
		"LeoStreamMapping": {
			"Type": "AWS::Lambda::EventSourceMapping",
			"Properties": {
				"BatchSize": 500,
				"Enabled": true,
				"StartingPosition": "TRIM_HORIZON",
				"EventSourceArn": {
					"Fn::Sub": "${LeoStream.StreamArn}"
				},
				"FunctionName": {
					"Ref": "LeoStreamTableProcessor"
				}
			},
			"DependsOn": [
				"LeoCronRole"
			]
		},
		"LeoMonitorMapping": {
			"Type": "AWS::Lambda::EventSourceMapping",
			"Properties": {
				"BatchSize": 500,
				"Enabled": true,
				"StartingPosition": "TRIM_HORIZON",
				"EventSourceArn": {
					"Fn::Sub": "${LeoCron.StreamArn}"
				},
				"FunctionName": {
					"Ref": "LeoMonitor"
				}
			}
		},
		"PermissionForLeoCronSchedulerRule": {
			"Type": "AWS::Lambda::Permission",
			"Properties": {
				"FunctionName": {
					"Ref": "LeoCronScheduler"
				},
				"Action": "lambda:InvokeFunction",
				"Principal": "events.amazonaws.com",
				"SourceArn": {
					"Fn::Sub": "${LeoCronSchedulerRule.Arn}"
				}
			}
		},
	}
};
