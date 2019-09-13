"use strict";

const registerReplicationBots = require("./register-replication-bots");
const sendCustomResourceResponse = require('../../lib/sendCustomResourceResponse');
const logger = require('leo-logger');

exports.handler = (event, _, callback) => {
	logger.log(JSON.stringify(event, null, 2));
	try {
		event.PhysicalResourceId = event.LogicalResourceId;
		registerReplicationBots(event.ResourceProperties).then(() => {
			logger.info("Replication Bots Registered");
			sendCustomResourceResponse(event, 'SUCCESS')
				.then(() => callback()).catch(callback);
		}).catch((err) => {
			logger.error("Got error: ", err);
			sendCustomResourceResponse(event, 'FAILED', err.message)
				.then(() => callback()).catch(callback);
		});
	} catch (err) {
		logger.error("Caught error: ", err);
		sendCustomResourceResponse(event, 'FAILED', err.message)
			.then(() => callback()).catch(callback);
	}
};
