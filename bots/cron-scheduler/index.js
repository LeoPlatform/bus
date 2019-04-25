let legacy = require("leo-cron/lib/legacy.js");
exports.handler = require("leo-cron/lib/scheduler.js")(Object.assign({
	region: process.env.AWS_DEFAULT_REGION,
	LeoCron: process.env.LeoCron,
	LeoSettings: process.env.LeoSettings
}, legacy));