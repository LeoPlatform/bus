module.exports = {
	Resources: {
		"LeoInstallRole": {
			"Type": "AWS::IAM::Role",
			"Properties": {
				"AssumeRolePolicyDocument": {
					"Version": "2012-10-17",
					"Statement": [
						{
							"Effect": "Allow",
							"Principal": {
								"Service": [
									"lambda.amazonaws.com"
								],
								"AWS": {
									"Fn::Sub": "arn:aws:iam::${AWS::AccountId}:root"
								}
							},
							"Action": [
								"sts:AssumeRole"
							]
						}
					]
				},
				"ManagedPolicyArns": [
					"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
					{
						"Ref": "LeoBotPolicy"
					}
				],
				"Policies": [
					{
						"PolicyName": "Leo_Install",
						"PolicyDocument": {
							"Version": "2012-10-17",
							"Statement": [
								{
									"Effect": "Allow",
									"Action": [
										"lambda:AddPermission"
									],
									"Resource": [
										{
											"Fn::Sub": "${LeoS3LoadTrigger.Arn}"
										}
									]
								},
								{
									"Effect": "Allow",
									"Action": [
										"s3:PutBucketNotification",
										"s3:GetBucketNotification"
									],
									"Resource": [
										{
											"Fn::Sub": "${LeoS3.Arn}"
										}
									]
								},
								{
									"Effect": "Allow",
									"Action": [
										"iam:ListAttachedRolePolicies",
										"iam:AttachRolePolicy"
									],
									"Resource": [
										{
											"Fn::Sub": "${LeoFirehoseRole.Arn}"
										}
									]
								},
								{
									"Effect": "Allow",
									"Action": [
										"dynamodb:UpdateItem"
									],
									"Resource": [
										{
											"Fn::Sub": "${LeoCron.Arn}"
										}
									]
								}
							]
						}
					}
				]
			}
		},
		"LeoKinesisRole": {
			"Type": "AWS::IAM::Role",
			"Properties": {
				"AssumeRolePolicyDocument": {
					"Version": "2012-10-17",
					"Statement": [
						{
							"Effect": "Allow",
							"Principal": {
								"Service": [
									"lambda.amazonaws.com"
								],
								"AWS": {
									"Fn::Sub": "arn:aws:iam::${AWS::AccountId}:root"
								}
							},
							"Action": [
								"sts:AssumeRole"
							]
						}
					]
				},
				"ManagedPolicyArns": [
					"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
					{
						"Ref": "LeoBotPolicy"
					}
				],
				"Policies": [
					{
						"PolicyName": "Leo_core",
						"PolicyDocument": {
							"Version": "2012-10-17",
							"Statement": [
								{
									"Effect": "Allow",
									"Action": [
										"kinesis:DescribeStream",
										"kinesis:GetRecords",
										"kinesis:GetShardIterator",
										"kinesis:ListStreams"
									],
									"Resource": [
										{
											"Fn::Sub": "${LeoKinesisStream.Arn}"
										}
									]
								},
								{
									"Effect": "Allow",
									"Action": [
										"s3:PutObject"
									],
									"Resource": [
										{
											"Fn::Sub": "arn:aws:s3:::${LeoS3}"
										},
										{
											"Fn::Sub": "arn:aws:s3:::${LeoS3}/*"
										}
									]
								},
								{
									"Effect": "Allow",
									"Action": [
										"dynamodb:PutItem",
										"dynamodb:BatchWriteItem",
										"dynamodb:BatchGetItem",
										"dynamodb:GetRecords",
										"dynamodb:UpdateItem",
										"dynamodb:Query",
										"dynamodb:GetShardIterator",
										"dynamodb:DescribeStream",
										"dynamodb:ListStreams"
									],
									"Resource": [
										{
											"Fn::Sub": "${LeoEvent.Arn}"
										},
										{
											"Fn::Sub": "${LeoStream.Arn}"
										},
										{
											"Fn::Sub": "${LeoCron.Arn}"
										}
									]
								}
							]
						}
					}
				]
			}
		},
		"LeoBotRole": {
			"Type": "AWS::IAM::Role",
			"Properties": {
				"AssumeRolePolicyDocument": {
					"Version": "2012-10-17",
					"Statement": [						
						{
							"Fn::If" : [
								"IsDestinationAccount",
								{
									"Effect": "Allow",
									"Principal": {
										"Service": [
											"lambda.amazonaws.com"
										],
										"AWS":[{
											"Fn::Sub": "arn:aws:iam::${AWS::AccountId}:root"
										},{
											"Fn::Sub": "arn:aws:iam::${QueueReplicationSourceAccountId}:root"
										}],
									},
									"Action": [
										"sts:AssumeRole"
									]
								},
								{
									"Effect": "Allow",
									"Principal": {
										"Service": [
											"lambda.amazonaws.com"
										],
										"AWS": {
											"Fn::Sub": "arn:aws:iam::${AWS::AccountId}:root"
										},
									},
									"Action": [
										"sts:AssumeRole"
									]
								}
							]
						}
					]
				},
				"ManagedPolicyArns": [
					"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
					{
						"Ref": "LeoBotPolicy"
					}
				],
				"Policies": []
			}
		},
		"LeoFirehoseRole": {
			"Type": "AWS::IAM::Role",
			"Properties": {
				"AssumeRolePolicyDocument": {
					"Version": "2012-10-17",
					"Statement": [
						{
							"Effect": "Allow",
							"Principal": {
								"Service": "firehose.amazonaws.com"
							},
							"Action": "sts:AssumeRole",
							"Condition": {
								"StringEquals": {
									"sts:ExternalId": {
										"Ref": "AWS::AccountId"
									}
								}
							}
						},
						{
							"Effect": "Allow",
							"Principal": {
								"Service": [
									"lambda.amazonaws.com"
								],
								"AWS": {
									"Fn::Sub": "arn:aws:iam::${AWS::AccountId}:root"
								}
							},
							"Action": [
								"sts:AssumeRole"
							]
						}
					]
				},
				"ManagedPolicyArns": [
					"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
				],
				"Policies": [
					{
						"PolicyName": "Leo_Bus_firehose",
						"PolicyDocument": {
							"Version": "2012-10-17",
							"Statement": [
								{
									"Effect": "Allow",
									"Action": [
										"s3:AbortMultipartUpload",
										"s3:GetBucketLocation",
										"s3:GetObject",
										"s3:ListBucket",
										"s3:ListBucketMultipartUploads",
										"s3:PutObject"
									],
									"Resource": [
										{
											"Fn::Sub": "arn:aws:s3:::${LeoS3}"
										},
										{
											"Fn::Sub": "arn:aws:s3:::${LeoS3}/*"
										}
									]
								},
								{
									"Effect": "Allow",
									"Action": [
										"dynamodb:PutItem",
										"dynamodb:GetItem",
										"dynamodb:UpdateItem",
										"dynamodb:BatchGetItem",
										"dynamodb:BatchWriteItem",
										"dynamodb:GetRecords"
									],
									"Resource": [
										{
											"Fn::Sub": "${LeoSettings.Arn}"
										},
										{
											"Fn::Sub": "${LeoEvent.Arn}"
										},
										{
											"Fn::Sub": "${LeoStream.Arn}"
										}
									]
								}
							]
						}
					}
				]
			}
		},
		"LeoCronRole": {
			"Type": "AWS::IAM::Role",
			"Properties": {
				"AssumeRolePolicyDocument": {
					"Version": "2012-10-17",
					"Statement": [
						{
							"Effect": "Allow",
							"Principal": {
								"Service": [
									"lambda.amazonaws.com"
								],
								"AWS": {
									"Fn::Sub": "arn:aws:iam::${AWS::AccountId}:root"
								}
							},
							"Action": [
								"sts:AssumeRole"
							]
						}
					]
				},
				"ManagedPolicyArns": [
					"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
					{
						"Ref": "LeoBotPolicy"
					}
				],
				"Policies": [
					{
						"PolicyName": "State_machine_exec",
						"PolicyDocument": {
							"Version": "2012-10-17",
							"Statement": [
								{
									"Sid": "VisualEditor0",
									"Effect": "Allow",
									"Action": [
										"states:DescribeStateMachineForExecution",
										"states:ListStateMachines",
										"states:DescribeActivity",
										"states:DescribeStateMachine",
										"states:ListActivities",
										"states:DescribeExecution",
										"states:ListExecutions",
										"states:GetExecutionHistory",
										"states:StartExecution"
									],
									"Resource": "*"
								}
							]
						}
					},
					{
						"PolicyName": "Leo_cron",
						"PolicyDocument": {
							"Version": "2012-10-17",
							"Statement": [
								{
									"Effect": "Allow",
									"Action": [
										"dynamodb:Scan",
										"dynamodb:PutItem",
										"dynamodb:BatchWriteItem",
										"dynamodb:BatchGetItem",
										"dynamodb:UpdateItem",
										"dynamodb:Query"
									],
									"Resource": [
										{
											"Fn::Sub": "${LeoCron.Arn}"
										},
										{
											"Fn::Sub": "${LeoSystem.Arn}"
										},
										{
											"Fn::Sub": "${LeoCron.Arn}"
										}
									]
								},
								{
									"Effect": "Allow",
									"Action": [
										"dynamodb:GetRecords",
										"dynamodb:GetShardIterator",
										"dynamodb:DescribeStream",
										"dynamodb:ListStreams"
									],
									"Resource": [
										{
											"Fn::Sub": "${LeoCron.StreamArn}"
										},
										{
											"Fn::Sub": "${LeoEvent.StreamArn}"
										}
									]
								},
								{
									"Effect": "Allow",
									"Action": [
										"lambda:InvokeFunction"
									],
									"Resource": {
										"Fn::Sub": "arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:*"
									}
								}
							]
						}
					}
				]
			}
		},
		"LeoBotPolicy": {
			"Type": "AWS::IAM::ManagedPolicy",
			"Properties": {
				"PolicyDocument": {
					"Version": "2012-10-17",
					"Statement": [
						{
							"Effect": "Allow",
							"Action": [
								"kinesis:PutRecords",
								"kinesis:PutRecord"
							],
							"Resource": [
								{
									"Fn::Sub": "${LeoKinesisStream.Arn}"
								}
							]
						},
						{
							"Effect": "Allow",
							"Action": [
								"firehose:PutRecord",
								"firehose:PutRecordBatch"
							],
							"Resource": {
								"Fn::Sub": "arn:aws:firehose:${AWS::Region}:${AWS::AccountId}:deliverystream/${LeoFirehoseStream}"
							}
						},
						{
							"Effect": "Allow",
							"Action": [
								"dynamodb:Query"
							],
							"Resource": {
								"Fn::Sub": "${LeoStream.Arn}"
							}
						},
						{
							"Effect": "Allow",
							"Action": [
								"s3:PutObject",
								"s3:GetObject"
							],
							"Resource": {
								"Fn::Sub": "arn:aws:s3:::${LeoS3}/bus/*"
							}
						},
						{
							"Effect": "Allow",
							"Action": [
								"s3:PutObject",
								"s3:GetObject"
							],
							"Resource": {
								"Fn::Sub": "arn:aws:s3:::${LeoS3}/files/*"
							}
						},
						{
							"Effect": "Allow",
							"Action": [
								"s3:ListBucket"
							],
							"Resource": {
								"Fn::Sub": "arn:aws:s3:::${LeoS3}"
							}
						},
						{
							"Effect": "Allow",
							"Action": [
								"dynamodb:BatchGetItem",
								"dynamodb:BatchWriteItem",
								"dynamodb:UpdateItem",
								"dynamodb:PutItem"
							],
							"Resource": [
								{
									"Fn::Sub": "${LeoEvent.Arn}"
								},
								{
									"Fn::Sub": "${LeoSettings.Arn}"
								},
								{
									"Fn::Sub": "${LeoCron.Arn}"
								},
								{
									"Fn::Sub": "${LeoSystem.Arn}"
								}
							]
						},
						{
							"Effect": "Allow",
							"Action": [
								"dynamodb:Query",
								"dynamodb:Scan",
								"dynamodb:GetItem",
								"dynamodb:BatchGetItem"
							],
							"Resource": [
								{
									"Fn::Sub": "${LeoSettings.Arn}"
								},
								{
									"Fn::Sub": "${LeoCron.Arn}"
								},
								{
									"Fn::Sub": "${LeoEvent.Arn}"
								},
								{
									"Fn::Sub": "${LeoSystem.Arn}"
								}
							]
						},
						{
							"Effect": "Allow",
							"Action": [
								"ec2:CreateNetworkInterface",
								"ec2:DescribeNetworkInterfaces",
								"ec2:DetachNetworkInterface",
								"ec2:DeleteNetworkInterface",
								"cloudformation:DescribeStacks"
							],
							"Resource": "*"
						},
						{
							"Effect": "Allow",
							"Action": [
								"sns:Publish"
							],
							"Resource": {
								"Fn::Sub": "arn:aws:sns:${AWS::Region}:${AWS::AccountId}:*"
							}
						}
					]
				}
			}
		},
	}
};
