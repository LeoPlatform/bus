"use strict";

const leo = require("leo-sdk");
const ls = leo.streams;
const dynamodb = leo.aws.dynamodb;


const EventTable = leo.configuration.resources.LeoEvent;

console.log(leo.configuration);
// Archive Handler
exports.handler = (settings, context, callback) => {
	dynamodb.scan(EventTable, null, (err, data) => {
		console.log(err, data);
		return;
		if (err) {
			return callback(err);
		}
	});
};
