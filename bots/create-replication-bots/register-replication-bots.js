"use strict";
const leo = require("leo-sdk");

// TODO: On update.. delete the old bots. you can compare with old params passed in
// TODO: On delete.. do nothing. Just success return

function getSourceQueue(mapping) {
	if (typeof mapping === "string") {
		return {
			sourceQueue: mapping,
			destQueue: mapping
		};
	}
	return {
		sourceQueue: mapping.source,
		destQueue: mapping.destination
	};
}

module.exports = function ({
	ReplicatorLambdaName: lambdaName,
	QueueReplicationDestinationLeoBusStackName: destinationBusStack,
	QueueReplicationQueueMapping,
	QueueReplicationDestinationLeoBotRoleArn: destinationLeoBotRoleArn
}) {

	let queueMapping;
	try {
		queueMapping = JSON.parse(QueueReplicationQueueMapping);
		if (!Array.isArray(queueMapping))
			return Promise.reject(new Error("Malformed QueueReplicationQueueMapping parameter. Must be JSON Array."));
	} catch (err) {
		return Promise.reject(new Error("Malformed QueueReplicationQueueMapping parameter. Must be valid JSON."));
	}

	const createBotPromises = [];
	queueMapping.forEach(qm => {
		const { sourceQueue, destQueue } = getSourceQueue(qm);
		const botId = `${sourceQueue}-replication`;
		const botModel = {
			"id": botId,
			"triggers": [sourceQueue],
			"lambdaName": lambdaName,
			"settings": {
				"sourceQueue": sourceQueue,
				"destinationQueue": destQueue,
				"destinationBusStack": destinationBusStack,
				"destinationLeoBotRoleArn": destinationLeoBotRoleArn
			}
		};
		let createBotPromise;
		try {
			createBotPromise = leo.bot.createBot(botId, botModel);
		} catch (err) {
			return Promise.reject(new Error("Error Creating Bot."));
		}
		createBotPromises.push(createBotPromise);
	});
	return Promise.all(createBotPromises);
};
