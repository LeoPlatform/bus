"use strict";
const aws = require("aws-sdk");
const leo = require("leo-sdk");

module.exports = function (done) {
	let resources = leo.configuration.resources;
	return leo.bot.createBot(resources.LeoFirehoseStreamProcessor, require("../../firehose_processor/package.json").config.leo.cron);
};