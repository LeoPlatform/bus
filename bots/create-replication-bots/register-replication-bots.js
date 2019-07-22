"use strict";
const leo = require("leo-sdk");

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
	AccountId: currentAccount,
	StackName: currentStack,
	ReplicatorLambdaName: lambdaName,
	QueueReplicationSourceAccount: sourceAccount,
	QueueReplicationDestinationAccount: destinationAccount,
	QueueReplicationDestinationLeoBusStackName: destinationBusStack,
	QueueReplicationSourceLeoBusStackName: sourceBusStack,
	QueueReplicationQueueMapping,
	DestinationLeoBotRoleArn,
	DestinationLeoBotPolicyArn
}) {

	let queueMapping;
	try {
		queueMapping = JSON.parse(QueueReplicationQueueMapping);
		if (!Array.isArray(queueMapping))
			return Promise.reject(new Error("Malformed QueueReplicationQueueMapping parameter. Must be JSON Array."));
	} catch (err) {
		return Promise.reject(new Error("Malformed QueueReplicationQueueMapping parameter. Must be valid JSON."));
	}

	const isSourceStack = (currentAccount === sourceAccount && currentStack === sourceBusStack );
	if (isSourceStack) {
		// The source account is responsible for replicating the data to the destination account
		const createBotPromises = [];
		queueMapping.forEach(qm => {
			const { sourceQueue, destQueue } = getSourceQueue(qm);
			const botId = `${sourceQueue}-replication`;
			const botModel = {
				"id": botId,
				"triggers": [`queue:${sourceQueue}`],
				"lambdaName": lambdaName,
				"settings": {
					"source": sourceQueue,
					"destinationQueue": destQueue,
					"destinationAccount": destinationAccount,
					"destinationBusStack": destinationBusStack,
					"destinationLeoBotRoleArn": DestinationLeoBotRoleArn,
					"destinationLeoBotPolicyArn": DestinationLeoBotPolicyArn
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
	}
	return Promise.resolve();
};
