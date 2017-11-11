"use strict";
const moment = require("moment");
const zlib = require("zlib");
const leo = require("leo-sdk")({
	kinesis: "Staging-LeoKinesisStream-1VV2I9X0LE7WT",
	firehose: "Staging-LeoFirehoseStream-2KPFQLPORBMC",
	s3: "staging-leos3-kwah9bq4vk1y",
	region: "us-west-2"
});
const ls = leo.streams;
const async = require("async");
const refUtil = require("leo-sdk/lib/reference.js");

const cron = leo.bot;

const pad = "0000000";
const padLength = -1 * pad.length;

const StreamTable = leo.configuration.resources.LeoStream;
const EventTable = leo.configuration.resources.LeoEvent;



exports.handler = function (event, context, callback) {
	var timestamp = moment(event.Records[0].kinesis.approximateArrivalTimestamp * 1000);
	var ttl = timestamp.clone().add(1, "week").valueOf();

	var diff = moment.duration(moment().diff(timestamp));
	var currentTimeMilliseconds = moment().valueOf();

	var useS3Mode = false;
	if (diff.asSeconds() > 3 || event.Records.length > 100) {
		useS3Mode = true;
	}
	var events = {};
	var maxKinesis = {};
	var stats = {};

	var eventId = "z/" + timestamp.format("YYYY/MM/DD/HH/mm/" + timestamp.valueOf());
	var recordCount = 0;

	function getEventStream(event) {
		if (!(event in events)) {
			console.log("new event", event);
			var assignIds = ls.through((obj, done) => {
				obj.start = eventId + "-" + (pad + recordCount).slice(padLength);
				maxKinesis[event].max = obj.end = eventId + "-" + (pad + (recordCount + obj.end)).slice(padLength);
				recordCount += obj.records;
				obj.v = 2;

				obj.ttl = ttl;

				for (let botid in obj.stats) {
					if (!(botid in stats)) {
						stats[botid] = {
							[event]: obj.stats[botid]
						};
					} else {
						if (!(event in stats[botid])) {
							stats[botid][event] = obj.stats[botid];
						} else {
							let s = stats[botid][event];
							let r = obj.stats[botid];
							s.units += r.units;
							s.start = r.start;
							s.end = r.end;
							s.checkpoint = r.checkpoint;
						}
					}
				}
				delete obj.stats;
				delete obj.correlations;
				done(null, obj);
			});
			if (useS3Mode) {
				events[event] = ls.pipeline(ls.toS3GzipChunks(event, {}), assignIds, ls.toDynamoDB(StreamTable));
			} else {
				events[event] = ls.pipeline(ls.toGzipChunks(event, {}), assignIds, ls.toDynamoDB(StreamTable));
			}
			maxKinesis[event] = {
				max: null
			};
		}
		return events[event];
	}

	function closeStreams(callback) {
		var tasks = [];
		var eventUpdateTasks = [];

		for (let event in events) {
			tasks.push((done) => {
				console.log("closing streams", event);
				events[event].on("finish", () => {
					console.log("got finish from stream", event, maxKinesis[event].max);
					eventUpdateTasks.push({
						table: EventTable,
						key: {
							event: event
						},
						set: {
							max_eid: maxKinesis[event].max,
							timestamp: moment.now(),
							v: 2
						}
					});
					done();
				}).on("error", (err) => {
					console.log(err);
					done(err);
				});
				events[event].end();
			});
		}
		async.parallel(tasks, (err) => {
			if (err) {
				console.log("error");
				console.log(err);
				callback(err);
			} else {
				console.log("finished writing");
				leo.aws.dynamodb.updateMulti(eventUpdateTasks, (err, results) => {
					if (err) {
						callback("Cannot write event locations to dynamoDB");
					} else {
						var checkpointTasks = [];
						for (let bot in stats) {
							for (let event in stats[bot]) {
								let stat = stats[bot][event];
								checkpointTasks.push(function (done) {
									cron.checkpoint(bot, event, {
										eid: eventId + "-" + (pad + stat.checkpoint).slice(padLength),
										source_timestamp: stat.start,
										started_timestamp: stat.end,
										ended_timestamp: timestamp.valueOf(),
										records: stat.units,
										type: "write"
									}, function (err) {
										done(err);
									});
								});
							}
						}
						console.log("checkpointing");
						async.parallelLimit(checkpointTasks, 100, function (err) {
							if (err) {
								console.log(err);
								callback(err);
							} else {
								callback(null, "Successfully processed " + event.Records.length + " records.");
							}
						});
					}
				});
			}
		});
	}

	var gzip = zlib.createGunzip();
	ls.pipe(gzip, ls.parse(), ls.through((event, callback) => {
		//We can't process it without these
		if (!event.event || ((!event.id || !event.payload) && !event.s3)) {
			callback(null);
			return;
		}
		event.event = refUtil.ref(event.event).queue().id;

		//If it is missing these, we can just create them.
		if (!event.timestamp) {
			event.timestamp = currentTimeMilliseconds;
		}
		if (!event.event_source_timestamp) {
			event.event_source_timestamp = event.timestamp;
		}

		getEventStream(event.event, eventId, useS3Mode).write(event, callback);
	}), function (err) {
		if (err) {
			callback(err);
		} else {
			closeStreams(callback);
		}
	});
	event.Records.map((record) => {
		gzip.write(new Buffer(record.kinesis.data, 'base64'));
	});
	gzip.end();
};