"use strict";

const registerReplicationBots = require("./register-replication-bots");
const sendCustomResourceResponse = require('../../lib/sendCustomResourceResponse');

exports.handler = (event, _, callback) => {
	console.log(JSON.stringify(event, null, 2));
	try {
		event.PhysicalResourceId = event.LogicalResourceId;
		registerReplicationBots(event.ResourceProperties).then(() => {
			console.log("Replication Bots Registered");
			sendCustomResourceResponse(event, 'SUCCESS')
				.then(() => callback()).catch(callback);
		}).catch((err) => {
			console.log("Got error: ", err);
			sendCustomResourceResponse(event, 'FAILED', err.message)
				.then(() => callback()).catch(callback);
		});
	} catch (err) {
		console.log("Caught error: ", err);
		sendCustomResourceResponse(event, 'FAILED', err.message)
			.then(() => callback()).catch(callback);
	}
};
