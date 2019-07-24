module.exports = {
	Parameters: {
		"QueueReplicationSourceAccountId" : {
			"Type" : "String",
			"Description" : "The account where replication source queues are located. Populate this parameter in the destination account to allow the source account access."
		},
		"QueueReplicationSourceLeoBusStackName" : {
			"Type" : "String",
			"Description" : "The Leo bus stack that is responsible for replicating a queue. You can replicate queues between stacks in the same account, so this helps differentiate."
		},
		"QueueReplicationDestinationLeoBotRoleArn" : {
			"Type" : "String",
			"Description" : "The LeoBotRole ARN from the destination account. This enables the replication bot to assume the role of a bot in the destination account."
		},
		"QueueReplicationDestinationLeoBusStackName" : {
			"Type" : "String",
			"Description" : "The Leo bus stack name that will receive the replicated queue. The replication bot will leverage this stack to learn about the Leo resources in the destination account."
		},
		"QueueReplicationQueueMapping" : {
			"Type" : "String",
			"Default" : "[]",
			"Description" : "A JSON array of Source-Destination Queue Mappings. i.e. [{source: \"srcqueue\", destination: \"dstqueue\"}, \"samequeue\"] (if source & destination are named the same, then just a list of strings). This parameter is only used by the source account."
		}
	},
	Conditions: {
		IsSourceStack: {
			"Fn::And": [
				{ "Fn::Equals" : [{ "Ref" : "AWS::AccountId" }, { "Ref": "QueueReplicationSourceAccountId" }] },
				{ "Fn::Equals" : [{ "Ref" : "AWS::StackName" }, { "Ref": "QueueReplicationSourceLeoBusStackName" }] }
			]			
		},
		IsDestinationAccount: {
			"Fn::And": [
				{
					"Fn::Not": [
						{ "Fn::Equals" : [{ "Ref" : "QueueReplicationSourceAccountId" }, ""] }
					]			
				},
				{
					"Fn::Not": [
						{ "Fn::Equals" : [{ "Ref" : "QueueReplicationSourceAccountId" }, { "Ref": "AWS::AccountId" }] }
					]			
				}
			]			
		}
	},
	Resources: {
		"ReplicationBots": {
			"Type": "Custom::ReplicationBots",
			"Condition": "IsSourceStack",
			"Properties": {
				"QueueReplicationDestinationLeoBotRoleArn": { "Ref": "QueueReplicationDestinationLeoBotRoleArn"},
				"QueueReplicationDestinationLeoBusStackName": { "Ref": "QueueReplicationDestinationLeoBusStackName"},
				"QueueReplicationQueueMapping": { "Ref": "QueueReplicationQueueMapping"},
				"ReplicatorLambdaName": { "Fn::GetAtt": ["SourceQueueReplicator", "Arn"] },
				"ServiceToken": {
					"Fn::Sub": "${LeoCreateReplicationBots.Arn}"
				},
				"Version": "1.0"
			},
			"DependsOn": [
				"LeoCreateReplicationBots", "SourceQueueReplicator", "LeoInstallRole"
			]
		},
		"SourceQueueReplicatorRole": {
			"Type": "AWS::IAM::Role",
			"Condition": "IsSourceStack",
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
						"PolicyName": "SourceQueueReplicatorRolePolicy",
						"PolicyDocument": {
							"Version": "2012-10-17",
							"Statement": [
								{
									"Effect": "Allow",
									"Action": "sts:AssumeRole",
									"Resource":{
										"Ref": "QueueReplicationDestinationLeoBotRoleArn"
									} 
								}
							]
						}
					}

				]
			}
		},
	},
	Outputs: {
		"SourceQueueReplicator": {
			"Description": "Leo Source Queue Replicator Bot",
			"Condition": "IsSourceStack",
			"Value": {
				"Fn::Sub": "${SourceQueueReplicator.Arn}"
			},
			"Export": {
				"Name": {
					"Fn::Sub": "${AWS::StackName}-SourceQueueReplicator"
				}
			}			
		}
	},
};
