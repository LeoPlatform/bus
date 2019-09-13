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

	const stackOutputs = descStackresult.Stacks[0].Outputs.reduce((map, output)=>{
		map[output.OutputKey] = output.OutputValue;
		return map;
	}, {});

	const leoStackConfiguration = {
		credentials,
		resources: {
			LeoCron: stackOutputs.LeoCron,
			LeoEvent: stackOutputs.LeoEvent,
			LeoFirehoseStream: stackOutputs.LeoFirehoseStream,
			LeoKinesisStream: stackOutputs.LeoKinesisStream,
			LeoS3: stackOutputs.LeoS3,
			LeoSettings: stackOutputs.LeoSettings,
			LeoStream: stackOutputs.LeoStream,
			LeoSystem: stackOutputs.LeoSystem
		},
		firehose: stackOutputs.LeoFirehoseStream,
		kinesis: stackOutputs.LeoKinesisStream,
		s3: stackOutputs.LeoS3
	};
	return leoStackConfiguration;
};
