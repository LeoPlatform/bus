"use strict";
const leo = require("leo-sdk");

function getSourceQueue(mapping){
	if (typeof mapping === "string") return mapping;
	return mapping.source;
}

module.exports = function (
	{ AccountId: account, 
		ReplicatorLambdaName: lambdaName, 
		QueueReplicationSourceAccount: sourceAccount,
		QueueReplicationQueueMapping
	}) {

	let queueMapping;
	try {
		queueMapping = JSON.parse(QueueReplicationQueueMapping);
		if (!Array.isArray(queueMapping)) 
			return Promise.reject(new Error("Malformed QueueReplicationQueueMapping parameter. Must be JSON Array."));
	} catch (err) {
		return Promise.reject(new Error("Malformed QueueReplicationQueueMapping parameter. Must be valid JSON."));
	}

	const isSourceAccount = (account === sourceAccount);
	if (isSourceAccount) {
		// The source account is responsible for replicating the data to the destination account
		const createBotPromises = [];
		queueMapping.forEach(qm => {
			const sourceQueue = getSourceQueue(qm);
			const botId = `${sourceQueue}-replication`;
			const botModel = {
				"id": botId,
				"triggers": [sourceQueue],
				"lambdaName": lambdaName
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
