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
				//TrustedAWSPrinciples: 'arn:aws:iam::117870855864:root',
				TrustedAWSPrinciples: '',
				QueueReplicationDestinationLeoBotRoleARNs: 'arn:aws:iam::086145306093:role/dev-bus-LeoBotRole-GM0Y7XC9MM2Z, arn:aws:iam::117870855864:role/test-bus-LeoBotRole-BCL1EDE260PC',
				QueueReplicationMapping: '[{"testrep_random_numbers": {"account":"117870855864", "stack":"test-bus", "destination":"testrep_random_numbers"}},{"testrep_random_numbers": {"account":"086145306093", "stack":"dev-bus", "destination":"testrep_random_numbers"}}]'
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
