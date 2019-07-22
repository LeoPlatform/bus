'use strict';

const AWS = require('aws-sdk');
const { read, streams: ls } = require('leo-sdk');
const getLeoConfigFromBusStack = require('../../lib/getLeoConfigFromBusStack');
/* 
  This is triggered from the source account
	It must reach out to the destination account/stack to get the configuration
	
	The bot should probably check the stack params to verify it is still wanted
*/
exports.handler = require("leo-sdk/wrappers/cron")(function (event, context, callback) {
	console.log("SourceRepEvent", JSON.stringify(event, null, 2));
	var sts = new AWS.STS();
	var params = {
		DurationSeconds: 900,
		RoleArn: event.destinationLeoBotRoleArn,
		RoleSessionName: "SourceQueueReplicator"
	};
	sts.assumeRole(params, function (err, data) {
		if (err) {
			console.log("Assumed Role: ", err, err.stack); // an error occurred
			return callback(err);
		} 
		console.log("Got AssumedRole data");
		const tempCredentials = sts.credentialsFrom(data);
		getLeoConfigFromBusStack(event.destinationBusStack, tempCredentials).then((destinationConfig) => {
			console.log("Got Stack Description");
			const { load } = require('leo-sdk')(destinationConfig);
	
			const stats = ls.stats(event.botId, event.source);
			ls.pipe(
				read(event.botId, event.source),
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
