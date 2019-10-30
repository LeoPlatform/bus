module.exports = {
	Resources: {
		"LeoKinesisStream": {
			"Type": "AWS::Kinesis::Stream",
			"Properties": {
				"ShardCount": 1
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
			]
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
			}
		},
	}
};
