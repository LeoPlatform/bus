'use strict';

const AWS = require('aws-sdk');
const { read, streams: ls } = require('leo-sdk');
const getLeoConfigFromBusStack = require('../../lib/getLeoConfigFromBusStack');
const logger = require('leo-logger');

exports.handler = require("leo-sdk/wrappers/cron")(function (event, context, callback) {
	logger.info("SourceRepEvent", JSON.stringify(event, null, 2));
	var sts = new AWS.STS();
	var params = {
		DurationSeconds: 900,
		RoleArn: event.destinationLeoBotRoleArn,
		RoleSessionName: "SourceQueueReplicator"
	};
	sts.assumeRole(params, function (err, data) {
		if (err) {
			logger.info("Assumed Role: ", err, err.stack); // an error occurred
			return callback(err);
		} 
		logger.info("Got AssumedRole data");
		const tempCredentials = sts.credentialsFrom(data);
		getLeoConfigFromBusStack(event.destinationBusStack, tempCredentials).then((destinationConfig) => {
			logger.info("Got Stack Description");
			const { load } = require('leo-sdk')(destinationConfig);
	
			const stats = ls.stats(event.botId, event.sourceQueue);
			ls.pipe(
				read(event.botId, event.sourceQueue),
				stats,
				load(event.botId, event.destinationQueue),
				(err) => {
					if (err) return callback(err);
					stats.checkpoint(callback);
				}
			);
		}).catch(callback);
	});
});
