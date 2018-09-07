module.exports = {
    Outputs: {
        "Role": {
            "Description": "Role for Read/Write to the Bus",
            "Value": {
                "Fn::Sub": "${LeoBotRole.Arn}"
            },
            "Export": {
                "Name": {
                    "Fn::Sub": "${AWS::StackName}-Role"
                }
            }
        },
        "Policy": {
            "Description": "Policy for Read/Write to the Bus",
            "Value": {
                "Ref": "LeoBotPolicy"
            },
            "Export": {
                "Name": {
                    "Fn::Sub": "${AWS::StackName}-Policy"
                }
            }
        },
        "LeoStream": {
            "Description": "LeoStream Table",
            "Value": {
                "Fn::Sub": "${LeoStream}"
            },
            "Export": {
                "Name": {
                    "Fn::Sub": "${AWS::StackName}-LeoStream"
                }
            }
        },
        "LeoCron": {
            "Description": "LeoCron Table",
            "Value": {
                "Fn::Sub": "${LeoCron}"
            },
            "Export": {
                "Name": {
                    "Fn::Sub": "${AWS::StackName}-LeoCron"
                }
            }
        },
        "LeoEvent": {
            "Description": "LeoEvent Table",
            "Value": {
                "Fn::Sub": "${LeoEvent}"
            },
            "Export": {
                "Name": {
                    "Fn::Sub": "${AWS::StackName}-LeoEvent"
                }
            }
        },
        "LeoSettings": {
            "Description": "LeoSettings Table",
            "Value": {
                "Fn::Sub": "${LeoSettings}"
            },
            "Export": {
                "Name": {
                    "Fn::Sub": "${AWS::StackName}-LeoSettings"
                }
            }
        },
        "LeoSystem": {
            "Description": "LeoSystem Table",
            "Value": {
                "Fn::Sub": "${LeoSystem}"
            },
            "Export": {
                "Name": {
                    "Fn::Sub": "${AWS::StackName}-LeoSystem"
                }
            }
        },
        "LeoS3": {
            "Description": "Leo S3 Bucket",
            "Value": {
                "Fn::Sub": "${LeoS3}"
            },
            "Export": {
                "Name": {
                    "Fn::Sub": "${AWS::StackName}-LeoS3"
                }
            }
        },
        "LeoKinesisStream": {
            "Description": "Leo Kinesis Stream",
            "Value": {
                "Fn::Sub": "${LeoKinesisStream}"
            },
            "Export": {
                "Name": {
                    "Fn::Sub": "${AWS::StackName}-LeoKinesisStream"
                }
            }
        },
        "LeoFirehoseStream": {
            "Description": "Leo Firehose Stream",
            "Value": {
                "Fn::Sub": "${LeoFirehoseStream}"
            },
            "Export": {
                "Name": {
                    "Fn::Sub": "${AWS::StackName}-LeoFirehoseStream"
                }
            }
        },
        "Region": {
            "Description": "Leo Region",
            "Value": {
                "Fn::Sub": "${AWS::Region}"
            },
            "Export": {
                "Name": {
                    "Fn::Sub": "${AWS::StackName}-Region"
                }
            }
        },
        "Register": {
            "Description": "Leo Register Bot",
            "Value": {
                "Fn::Sub": "${LeoInstallFunction.Arn}"
            },
            "Export": {
                "Name": {
                    "Fn::Sub": "${AWS::StackName}-Register"
                }
            }
        }
    }
}