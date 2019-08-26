"use strict";
const leo = require("leo-sdk");
const ls = leo.streams;
const logger = require("leo-sdk/lib/logger.js")("leo-archive");
const dynamodb = leo.aws.dynamodb;
const async = require("async");
const moment = require("moment");

const EventTable = leo.configuration.resources.LeoEvent;

exports.handler = require("leo-sdk/wrappers/cron")(async (settings, context, callback) => {

	let parallelLimit = process.env.parallelLimit || settings.parallelLimit || 5;
	let exit = false;
	let timeout = setTimeout(() => {
		exit = true;
	}, context.getRemainingTimeInMillis() * 0.5);

	let cb = callback;
	callback = (err, data) => {
		clearTimeout(timeout);
		cb(err, data);
	};

	let stopTime = moment().add(context.getRemainingTimeInMillis() * 0.7, "milliseconds");

	dynamodb.scan(EventTable, null, (err, data) => {
		let maxEidToArchive = moment().format("[z]/YYYY/MM/DD");
		let tasks = [];

		data.map(q => {
			q.archive = Object.assign({
				end: 'z/0'
			}, q.archive);
			return q;
		}).sort((a, b) => a.archive.end.localeCompare(b.archive.end)).forEach(queue => {
			if (queue.skip_archive == true || queue.event.match(/\/_snapshot$/) || queue.event.match(/\/_archive$/)) {
				queue.skip_archive == true && logger.info(queue.event, "Skipping");
				return;
			}
			if (queue.max_eid &&
				(!queue.archive ||
					(queue.archive.end != queue.max_eid && queue.archive.end != maxEidToArchive && maxEidToArchive.localeCompare(queue.archive.end) > 0)
				)
			) {

				logger.log(queue.event, "queue start: ", (queue.archive || {}).end || "z/0");
				tasks.push(done => {
					if (exit) {
						logger.info(queue.event, "Not enough remaining time to run");
						return done();
					}
					logger.log(queue.event, "Starting to run");
					ls.pipe(leo.read('leo-archiver', queue.event, {
						start: queue.archive.end || "z/0",
						loops: Number.POSITIVE_INFINITY,
						stopTime: stopTime,
					}), ls.counter(queue.event), ls.toS3GzipChunks(queue.event, {
						useS3Mode: true,
						time: {
							minutes: 20
						},
						archive: true
					}), ls.toLeo("leo-archiver"), ls.devnull(), done);
				});
			} else {
				logger.info(queue.event, "Complete");
			}
		});
		async.parallelLimit(tasks, parallelLimit, (err) => {
			err && logger.error(err);
			callback(err);
		});
	});
});
