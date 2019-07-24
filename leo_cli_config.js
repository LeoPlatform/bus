'use strict';
module.exports = {
	publish: [{
		leoaws: {
			profile: 'seriouscoderone',
			region: 'us-east-1'
		},
		public: true,
	}],
	deploy: {
		dev: {
			stack: 'dev-bus',
			parameters: {
				QueueReplicationSourceAccountId: '',
				QueueReplicationSourceLeoBusStackName: '',
				QueueReplicationDestinationLeoBotRoleArn: '',
				QueueReplicationDestinationLeoBusStackName: '',
				QueueReplicationQueueMapping: '[]'
			},
			region: 'us-east-1'
		},
		test: {
			stack: 'test-bus',
			parameters: {
				QueueReplicationSourceAccountId: '',
				QueueReplicationSourceLeoBusStackName: '',
				QueueReplicationDestinationLeoBotRoleArn: '',
				QueueReplicationDestinationLeoBusStackName: '',
				QueueReplicationQueueMapping: '[]'
			},
			region: 'us-east-1'
		}
	}
};
