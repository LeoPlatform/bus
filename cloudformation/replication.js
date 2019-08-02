module.exports = {
	Parameters: {
		"TrustedAWSPrinciples" : {
			"Type" : "CommaDelimitedList",
			"Description" : "List of AWS principles this stack trusts. (i.e. arn:aws:iam::<account_id>:root) Trusted accounts can assume the role of a bot on this stack and write to it."
		},
		"QueueReplicationDestinationLeoBotRoleARNs" : {
			"Type" : "CommaDelimitedList",
			"Description" : "List of LeoBotRole Arn's this stack will assume for replication."
		},
		"QueueReplicationMapping" : {
			"Type" : "String",
			"Default": "[]",
			"Description" : "JSON Array of Objects of the form [{\"SOURCE_QUEUE\": { \"account\": \"DEST_ACCOUNT_ID\", \"stack\": \"DEST_STACK_NAME\", \"destination\":  \"DEST_QUEUE\"}}, {...}]"
		}
	},
	Conditions: {
		IsTrustingAccount: {
			"Fn::Not": [
				{ "Fn::Equals" : [{ "Fn::Join" : [ ",", { "Ref" : "TrustedAWSPrinciples" } ] }, ""] }
			]			
		},
		IsReplicatingStack: {
			"Fn::And": [
				{
					"Fn::Not": [
						{ "Fn::Equals" : [{ "Fn::Join" : [ ",", { "Ref" : "QueueReplicationDestinationLeoBotRoleARNs" } ] }, ""] }
					]			
				},
				{
					"Fn::Not": [
						{ "Fn::Equals" : [{ "Ref" : "QueueReplicationMapping" }, "[]"] }
					]			
				}
			]			
		}
	},
	Resources: {
		"SourceQueueReplicator": {
			"Condition": "IsReplicatingStack"
		},
		"RegisterReplicationBots": {
			"Type": "Custom::RegisterReplicationBots",
			"Condition": "IsReplicatingStack",
			"Properties": {
				"QueueReplicationDestinationLeoBotRoleARNs": { "Ref": "QueueReplicationDestinationLeoBotRoleARNs"},
				"QueueReplicationMapping": { "Ref": "QueueReplicationMapping"},
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
			"Condition": "IsReplicatingStack",
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
										"Ref": "QueueReplicationDestinationLeoBotRoleARNs"
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
			"Condition": "IsReplicatingStack",
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
