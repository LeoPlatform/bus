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
			region: 'us-west-2'
		}
	}
};
