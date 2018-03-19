"use strict";
const aws = require("aws-sdk");
const leo = require("leo-sdk");

module.exports = function(resource, data) {
	if (typeof data === "string") {
		data = JSON.parse(data);
	}
	data = fixTypes(data);

	let id = data.id.replace(/^arn:aws:lambda:.*?:\d+:function:(.*)$/, "$1");
	let type = data.LeoRegisterType || "bot";
	delete data.LeoRegisterType;

	if (type == "bot") {
		data.paused = data.paused == undefined ? true : data.paused == true;
		return leo.bot.createBot(id, data, {
			fields: {
				paused: {
					once: true
				}
			}
		});
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


let numberRegex = /^\d+(?:\.\d*)?$/;
let boolRegex = /^(?:false|true)$/i;
let nullRegex = /^null$/;
let undefinedRegex = /^undefined$/;

function fixTypes(node) {
	let type = typeof node;
	if (Array.isArray(node)) {
		for (let i = 0; i < node.length; i++) {
			node[i] = fixTypes(node[i])
		}
	} else if (type == "object" && node !== null) {
		Object.keys(node).map(key => {
			node[key] = fixTypes(node[key]);
		})
	} else if (type == "string") {
		if (numberRegex.test(node)) {
			return parseFloat(node);
		} else if (boolRegex.test(node)) {
			return node.toLowerCase() == "true"
		} else if (nullRegex.test(node)) {
			return null;
		} else if (undefinedRegex.test(node)) {
			return undefined;
		}
	}

	return node;
}