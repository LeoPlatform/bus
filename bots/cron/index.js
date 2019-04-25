let legacy = require("leo-cron/lib/legacy.js");
exports.handler = require("leo-cron/lib/processor.js")(Object.assign({
	region: process.env.AWS_DEFAULT_REGION,
	tableName: process.env.LeoCron
}, legacy));