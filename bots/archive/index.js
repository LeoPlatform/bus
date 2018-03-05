"use strict";

const leo = require("leo-sdk");
const ls = leo.streams;
const dynamodb = leo.aws.dynamodb;
const async = require("async");
const moment = require("moment");

const EventTable = leo.configuration.resources.LeoEvent;

console.log(leo.configuration);
// Archive Handler
exports.handler = (settings, context, callback) => {
	dynamodb.scan(EventTable, null, (err, data) => {
		let maxEidToArchive = moment().format("[z]/YYYY/MM/DD");
		let tasks = [];
		data.forEach(queue => {
			if (queue.event !== "monitor") {
				return;
			}
			queue.archive = Object.assign({
				// end: 'z/0'
				end: 'z/2018/01/21/09/50/1516553413029-0000002'
			}, queue.archive || {});
			if (queue.max_eid &&
				(!queue.archive ||
					(queue.archive.end != maxEidToArchive && maxEidToArchive.localeCompare(queue.archive.end) > 0)
				)
			) {
				tasks.push(done => {
					console.log("GOING TO RUN " + queue.event);
					ls.pipe(leo.read('leo-archiver', queue.event, {
						start: queue.archive.end,
						loops: Number.POSITIVE_INFINITY,
						stopTime: moment().add(240, "seconds"),
					}), ls.toS3GzipChunks(queue.event, {
						useS3Mode: true,
						time: {
							minutes: 20
						},
						archive: true
					}), ls.log(), ls.toLeo("leo-archiver"), done);
				});
			}
		});
		async.series(tasks, (err) => {
			console.log(err);

			callback(err);
		});
	});
};
