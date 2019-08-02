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
				TrustedAWSPrinciples: 'arn:aws:iam::117870855864:root',
				QueueReplicationDestinationLeoBotRoleARNs: '',
				QueueReplicationMapping: '[]'
			},
			region: 'us-east-1'
		},
		test: {
			stack: 'test-bus',
			parameters: {
				TrustedAWSPrinciples: '',
				// QueueReplicationDestinationLeoBotRoleArn: '',
				QueueReplicationDestinationLeoBotRoleARNs: '',
				QueueReplicationMapping: '[]'
			},
			region: 'us-east-1'
		}
	}
};
