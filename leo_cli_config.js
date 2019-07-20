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
				QueueReplicationSourceAccount: "<destination aws account id>",
				QueueReplicationDestinationAccount: "<destination aws account id>"
			},
			region: 'us-east-1'
		}
	}
};
