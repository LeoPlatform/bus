module.exports = {
	Parameters: {
		"QueueReplicationSourceAccount" : {
			"Type" : "String",
			"Description" : "The account where replication source queues are located."
		},
		"QueueReplicationSourceLeoBusStackName" : {
			"Type" : "String",
			"Description" : "The Leo bus stack that is responsible for replicating a queue."
		},
		"QueueReplicationDestinationAccount" : {
			"Type" : "String",
			"Description" : "The AWS Account that is the destination for Queue Replication. May be the same as the source account, if replicating between bus instances in the same account."
		},
		"QueueReplicationDestinationLeoBusStackName" : {
			"Type" : "String",
			"Description" : "The Leo bus stack name that will receive the replicated queue."
		},
		"QueueReplicationQueueMapping" : {
			"Type" : "String",
			"Default" : "[]",
			"Description" : "A JSON array of Source-Destination Queue Mappings. i.e. [{source: \"srcqueue\", destination: \"dstqueue\"}, \"samequeue\"] (if source & destination are named the same, then just a list of strings). This parameter is only used by the source account."
		}
	}
};
