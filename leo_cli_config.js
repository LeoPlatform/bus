'use strict';

module.exports = {
	publish: [{
		leoaws: {
			profile: 'leo',
			region: 'us-west-2'
		},
		public: true,
	}, {
		leoaws: {
			profile: 'leo',
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
