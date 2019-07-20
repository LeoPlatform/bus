module.exports = {
	Parameters: {
		"QueueReplicationSourceAccount" : {
			"Type" : "String",
			"Description" : "The account where replication source queues are located"
		},
		"QueueReplicationDestinationAccount" : {
			"Type" : "String",
			"Description" : "The AWS Account that is the destination for Queue Replication"
		},
		"QueueReplicationQueueMapping" : {
			"Type" : "String",
			"Default" : "[]",
			"Description" : "A JSON array of Source-Destination Queue Mappings. i.e. [{source: \"srcqueue\", destination: \"dstqueue\"}, \"samequeue\"] (if source & destination are named the same, then just a list of strings)"
		}
	}
};
