'use strict';

module.exports = {
	publish: [{
		leoaws: {
			profile: 'default',
			region: 'us-east-1'
		},
		public: true,
	}],
	deploy: {
		dev: {
			stack: 'dev-bus',
			parameters: {
				TrustedAWSPrinciples: '',
				QueueReplicationDestinationLeoBotRoleARNs: '',
				QueueReplicationMapping: '[]'
			},
			region: 'us-east-1'
		}
	}
};
