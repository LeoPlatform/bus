const AWS = require('aws-sdk');
const logger = require('leo-logger');

module.exports = async function (leoBusStackName, credentials) { // AWS.Credentails
	var cloudformation = (credentials)
		? new AWS.CloudFormation({ credentials })
		: new AWS.CloudFormation();

	var params = { StackName: leoBusStackName };
	const descStackresult = await cloudformation.describeStacks(params).promise();
	if (descStackresult.Stacks.length > 1) {
		logger.info(descStackresult.Stacks);
		throw new Error('Multiple stacks match criteria');
	}
	const stackOutputs = descStackresult.Stacks[0].Outputs;
	const leoStackConfiguration = {
		credentials,
		resources: {
			LeoCron: stackOutputs.find(o => o.OutputKey === 'LeoCron').OutputValue,
			LeoEvent: stackOutputs.find(o => o.OutputKey === 'LeoEvent').OutputValue,
			LeoFirehoseStream: stackOutputs.find(o => o.OutputKey === 'LeoFirehoseStream').OutputValue,
			LeoKinesisStream: stackOutputs.find(o => o.OutputKey === 'LeoKinesisStream').OutputValue,
			LeoS3: stackOutputs.find(o => o.OutputKey === 'LeoS3').OutputValue,
			LeoSettings: stackOutputs.find(o => o.OutputKey === 'LeoSettings').OutputValue,
			LeoStream: stackOutputs.find(o => o.OutputKey === 'LeoStream').OutputValue,
			LeoSystem: stackOutputs.find(o => o.OutputKey === 'LeoSystem').OutputValue
		},
		firehose: stackOutputs.find(o => o.OutputKey === 'LeoFirehoseStream').OutputValue,
		kinesis: stackOutputs.find(o => o.OutputKey === 'LeoKinesisStream').OutputValue,
		s3: stackOutputs.find(o => o.OutputKey === 'LeoS3').OutputValue
	};
	return leoStackConfiguration;
};
