"use strict";
const moment = require("moment");
const zlib = require("zlib");
const leo = require("leo-sdk");
const ls = leo.streams;
const async = require("async");
const refUtil = require("leo-sdk/lib/reference.js");

const cron = leo.bot;

const pad = "0000000";
const padLength = -1 * pad.length;

const StreamTable = leo.configuration.resources.LeoStream;
const EventTable = leo.configuration.resources.LeoEvent;



exports.handler = function(event, context, callback) {

	let eventsToSkip = {};
	let botsToSkip = {};

	if (process.env.skip_events) {
		eventsToSkip = process.env.skip_events.split(",").reduce((out, e) => {
			console.log(`Skipping all events to queue "${e}"`);
			out[refUtil.ref(e)] = true;
			out[e] = true;
			return out;
		}, {})
	}
	if (process.env.skip_bots) {
		botsToSkip = process.env.skip_bots.split(",").reduce((out, e) => {
			console.log(`Skipping all events from bot "${e}"`);
			out[e] = true;
			return out;
		}, {})
	}

	var timestamp = moment.utc(event.Records[0].kinesis.approximateArrivalTimestamp * 1000);
	var ttl = timestamp.clone().add(1, "week").valueOf();

	var diff = moment.duration(moment.utc().diff(timestamp));
	var currentTimeMilliseconds = moment.utc().valueOf();

	var useS3Mode = false;
	if (diff.asSeconds() > 3 || event.Records.length > 100) {
		useS3Mode = true;
	}
	var events = {};
	var maxKinesis = {};
	var stats = {};

	var eventId = "z/" + timestamp.format("YYYY/MM/DD/HH/mm/" + timestamp.valueOf());
	var recordCount = 0;

	function getEventStream(event, forcePrefix) {
		if (!(event in events)) {
			console.log("new event", event);
			var assignIds = ls.through((obj, done) => {
				if (forcePrefix) {
					obj.start = forcePrefix + "/" + timestamp.valueOf() + "-" + (pad + recordCount).slice(padLength);
				} else {
					obj.start = eventId + "-" + (pad + recordCount).slice(padLength);
				}
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
								checkpointTasks.push(function(done) {
									cron.checkpoint(bot, event, {
										eid: eventId + "-" + (pad + stat.checkpoint).slice(padLength),
										source_timestamp: stat.start,
										started_timestamp: stat.end,
										ended_timestamp: timestamp.valueOf(),
										records: stat.units,
										type: "write"
									}, function(err) {
										done(err);
									});
								});
							}
						}
						console.log("checkpointing");
						async.parallelLimit(checkpointTasks, 100, function(err) {
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

	var stream = ls.parse();
	ls.pipe(stream, ls.through((event, callback) => {
		//We can't process it without these
		if (event._cmd) {
			if (event._cmd == "registerSnapshot") {
				leo.aws.dynamodb.update(EventTable, event.event, {
					snapshot_start: event.start,
					snapshot_end: event.end,
					snapshot_continue: event.continueFrom
				}, callback);
			}
		} else if (!event.event || ((!event.id || !event.payload) && !event.s3) || eventsToSkip[event.event] || botsToSkip[event.id]) {
			callback(null);
			return;
		}

		if (event.snapshot) {
			event.event = refUtil.ref(event.event + "/_snapshot").queue().id;
		} else {
			event.event = refUtil.ref(event.event).queue().id;
		}

		//If it is missing these, we can just create them.
		if (!event.timestamp) {
			event.timestamp = currentTimeMilliseconds;
		}
		if (!event.event_source_timestamp) {
			event.event_source_timestamp = event.timestamp;
		}

		getEventStream(event.event, event.snapshot).write(event, callback);
	}), function(err) {
		if (err) {
			callback(err);
		} else {
			closeStreams(callback);
		}
	});
	event.Records.map((record) => {
		if (record.kinesis.data[0] === 'H') {
			stream.write(zlib.gunzipSync(new Buffer(record.kinesis.data, 'base64')));
		} else if (record.kinesis.data[0] === 'e' && record.kinesis.data[1] === 'J') {
			stream.write(zlib.inflateSync(new Buffer(record.kinesis.data, 'base64')))
		} else if (record.kinesis.data[0] === 'e' && record.kinesis.data[1] === 'y') {
			stream.write(Buffer.from(record.kinesis.data, 'base64').toString() + "\n")
		}
	});
	stream.end();
};
