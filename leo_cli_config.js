'use strict';
module.exports = {
	publish: [{
		leoaws: {
			profile: 'personal',
			region: 'us-east-1'
		},
		public: true,
	}],
	deploy: {
		dev: {
			stack: 'dev-bus',
			parameters: {
				QueueReplicationSourceAccount: "117870855864",
				QueueReplicationDestinationAccount: "117870855864",
				QueueReplicationDestinationLeoBusStackName: "test-bus",
				QueueReplicationQueueMapping: '["testrep_random_numbers"]'
			},
			region: 'us-east-1'
		},
		test: {
			stack: 'test-bus',
			parameters: {
				QueueReplicationSourceAccount: "117870855864",
				QueueReplicationDestinationAccount: "117870855864",
				QueueReplicationDestinationLeoBusStackName: "test-bus",
				QueueReplicationQueueMapping: '["testrep_random_numbers"]'
			},
			region: 'us-east-1'
		}
	}
};
