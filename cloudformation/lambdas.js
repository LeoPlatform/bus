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
            },
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "01aba2d2-519a-4826-9f55-376917fcaddd"
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
            ],
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "1f821f9f-3f4f-46a4-ad2e-6f0d968cbe1a"
                }
            }
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
            },
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "e5c5304e-4277-4d41-bc06-514213d8b15a"
                }
            }
        },
    }
}