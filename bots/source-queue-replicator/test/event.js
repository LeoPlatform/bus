module.exports = {
	source: 'testrep_random_numbers',
	destinationQueue: 'testrep_random_numbers',
	destinationBusStack: 'test-bus',
	destinationAccount: '111111111111',
	botId: 'testrep_random_numbers-replication',
	destinationLeoBotRoleArn: 'arn:aws:iam::111111111111:role/test-bus-LeoBotRole-222222222222',
	destinationLeoBotPolicyArn: 'arn:aws:iam::111111111111:policy/test-bus-LeoBotPolicy-222222222222'
};
