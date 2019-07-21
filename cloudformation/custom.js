module.exports = {
	Resources: {
		"LeoInstall": {
			"Type": "Custom::Install",
			"Properties": {
				"ServiceToken": {
					"Fn::Sub": "${LeoInstallFunction.Arn}"
				},
				"Version": "2.0"
			},
			"DependsOn": [
				"LeoInstallFunction", "SourceQueueReplicator"
			]
		},
		"ReplicationBots": {
			"Type": "Custom::ReplicationBots",
			"Properties": {
				"AccountId": { "Ref": "AWS::AccountId" },
				"StackName": { "Ref": "AWS::StackName" },
				"QueueReplicationSourceAccount": { "Ref": "QueueReplicationSourceAccount"},
				"QueueReplicationDestinationAccount": { "Ref": "QueueReplicationDestinationAccount"},
				"QueueReplicationDestinationLeoBusStackName": { "Ref": "QueueReplicationDestinationLeoBusStackName"},
				"QueueReplicationSourceLeoBusStackName": { "Ref": "QueueReplicationSourceLeoBusStackName"},
				"QueueReplicationQueueMapping": { "Ref": "QueueReplicationQueueMapping"},
				"ReplicatorLambdaName": { "Fn::GetAtt": ["SourceQueueReplicator", "Arn"] },
				"DestinationLeoBotRoleArn": {
					"Fn::ImportValue": { "Fn::Sub": "${QueueReplicationSourceLeoBusStackName}-Role"}
				},
				"ServiceToken": {
					"Fn::Sub": "${LeoCreateReplicationBots.Arn}"
				},
				"Version": "2.2"
			},
			"DependsOn": [
				"LeoCreateReplicationBots", "SourceQueueReplicator", "LeoInstallRole"
			]
		},
	}
};
