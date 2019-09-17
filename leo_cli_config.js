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
			stack: 'DevBus',
			parameters: {
				TrustedAWSPrinciples: '',
				QueueReplicationDestinationLeoBotRoleARNs: '',
				QueueReplicationMapping: '[]'
			},
			region: 'us-east-1'
		},
		test: {
			stack: 'TestBus',
			parameters: {
				TrustedAWSPrinciples: '',
				QueueReplicationDestinationLeoBotRoleARNs: 'arn:aws:iam::111111111111:role/DevBus-LeoBotRole-AAAAAAAAAAAA',
				QueueReplicationMapping: '["dim"]'
			},
			region: 'us-east-1'
		}
	}
};
