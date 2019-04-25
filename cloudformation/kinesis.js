module.exports = {
    Resources: {
        "LeoKinesisStream": {
            "Type": "AWS::Kinesis::Stream",
            "Properties": {
                "ShardCount": 1
            },
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "daf052f3-2344-4667-b866-d86452968eea"
                }
            }
        },
        "LeoKinesisStreamProcessorEventSource": {
            "Type": "AWS::Lambda::EventSourceMapping",
            "Properties": {
                "BatchSize": 10000,
                "Enabled": true,
                "StartingPosition": "TRIM_HORIZON",
                "EventSourceArn": {
                    "Fn::Sub": "${LeoKinesisStream.Arn}"
                },
                "FunctionName": {
                    "Ref": "LeoKinesisStreamProcessor"
                }
            },
            "DependsOn": [
                "LeoKinesisStream",
                "LeoKinesisRole",
                "LeoKinesisStreamProcessor"
            ],
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "3ad35aac-4ae2-4ce5-ae58-9f9eaea5055c"
                }
            }
        },
        "LeoFirehoseStream": {
            "Type": "AWS::KinesisFirehose::DeliveryStream",
            "Properties": {
                "S3DestinationConfiguration": {
                    "BucketARN": {
                        "Fn::Sub": "arn:aws:s3:::${LeoS3}"
                    },
                    "BufferingHints": {
                        "IntervalInSeconds": 60,
                        "SizeInMBs": 128
                    },
                    "Prefix": "firehose/",
                    "CompressionFormat": "UNCOMPRESSED",
                    "RoleARN": {
                        "Fn::Sub": "${LeoFirehoseRole.Arn}"
                    }
                }
            },
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "c67a892f-9385-451d-8457-2237fbcede54"
                }
            }
        },
    }
}