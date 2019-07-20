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
				"QueueReplicationSourceAccount": { "Ref": "QueueReplicationSourceAccount"},
				"QueueReplicationQueueMapping": { "Ref": "QueueReplicationQueueMapping"},
				"ReplicatorLambdaName": { "Fn::GetAtt": ["SourceQueueReplicator", "Arn"] },
				"ServiceToken": {
					"Fn::Sub": "${LeoCreateReplicationBots.Arn}"
				},
				"Version": "2.0"
			},
			"DependsOn": [
				"LeoCreateReplicationBots", "SourceQueueReplicator", "LeoInstallRole"
			]
		},
	}
};
