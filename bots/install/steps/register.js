"use strict";
const aws = require("aws-sdk");
const leo = require("leo-sdk");

module.exports = function (resource, data) {
	if (typeof data === "string") {
		data = JSON.parse(data);
	}
	let id = data.id.replace(/^arn:aws:lambda:.*?:\d+:function:(.*)$/, "$1");
	let type = data.LeoRegisterType || "bot";
	delete data.LeoRegisterType;

	if (type == "bot") {
		data.paused = data.paused == undefined ? true : data.paused;
		return leo.bot.createBot(id, data, { fields: { paused: { once: true } } });
	} else if (type == "system") {
		return new Promise((resolve, reject) => {
			leo.aws.dynamodb.merge(leo.configuration.resources.LeoSystem, id, data, (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			})
		});
	} else {
		return Promise.resolve();
	}
};