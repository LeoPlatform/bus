module.exports = {
    Resources: {
        "LeoS3": {
            "Type": "AWS::S3::Bucket",
            "Properties": {},
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "19e3af96-efef-4ffa-8f33-34034b079093"
                }
            }
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
            },
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "94c0817d-a4e1-4bb9-84bd-dd5c6a1b4fd3"
                }
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
            },
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "3bc4ec4b-c3e4-46c8-b654-91983cc52df8"
                }
            }
        },
    }
}