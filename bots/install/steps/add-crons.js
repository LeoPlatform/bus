"use strict";
const aws = require("aws-sdk");
const leo = require("leo-sdk");

module.exports = function (done) {
	let resources = leo.configuration.resources;
	let monitorConfig = require("../../leo-monitor/package.json").config.leo.cron;
	return Promise.all([leo.bot.createBot("leo_cron_monitor", monitorConfig),
		leo.bot.createBot(resources.LeoFirehoseStreamProcessor, require("../../firehose_processor/package.json").config.leo.cron)
	]);
};