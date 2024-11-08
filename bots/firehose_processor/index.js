"use strict";

const zlib = require("zlib");
const leo = require("leo-sdk");
leo.configuration.update({
	kinesis: leo.configuration.resources.LeoKinesisStream,
	s3: leo.configuration.resources.LeoS3,
	firehose: " ",
});
const ls = leo.streams;
const cron = leo.bot;
const async = require("async");
const refUtil = require("leo-sdk/lib/reference.js");

exports.handler = require("leo-sdk/wrappers/cron")(async (event, context, callback) => {
	var source = "commands.s3_bus_load";
	var botId = event.botId; //"Leo_firehose_processor";

	var checkpointData = {
		units: 0,
		eid: event.start
	};
	var loop = function(callback) {
		var events = {};
		checkpointData.units = 0;
		ls.pipe(ls.fromLeo(botId, source, {
			debug: event.debug,
			limit: 1,
			start: checkpointData.eid
		}), ls.through((obj, done) => {
			console.log(obj.payload.files);
			async.eachOfSeries(obj.payload.files, (file, i, done) => {
				console.log("S3 File:", file);
				ls.pipe(
					ls.fromS3(file),
					ls.split(),
					ls.through(function(data, done) {
						if (data[0] === 'H') {
							done(null, zlib.gunzipSync(Buffer.from(data, 'base64')) + "\n");
						} else if (data[0] === 'e' && data[1] === 'J') {
							done(null, zlib.inflateSync(Buffer.from(data, 'base64')) + "\n");
						} else if (data[0] === 'e' && data[1] === 'y') {
							done(null, Buffer.from(data, 'base64').toString() + "\n");
						} else {
							done(null, data + "\n");
						}
					}),
					ls.parse(),
					ls.through((obj, done) => {
						if (!obj.id && !obj.event) {
							done();
						} else {
							obj.event = refUtil.ref(obj.event).queue().id;
							if (!obj.timestamp) {
								obj.timestamp = Date.now();
							}
							if (!obj.event_source_timestamp) {
								obj.event_source_timestamp = obj.timestamp;
							}
							if (!(obj.event in events)) {
								/**
								 *   send to kinesis, let it log the stats and checkpointing.  Numerous retries should be allowed to prevent duplication
								 *   Need to validate that chunkEventStream understands these new type of objects and log them as their own row instead of nested.
								 */
								events[obj.event] = ls.pipeline(ls.toS3GzipChunks(obj.event, {}),
									ls.through((obj, done) => {
										obj.creator = "firehose";
										done(null, obj);
									}),
									ls.toLeo(botId, {
										debug: event.debug
									})
								);
							}
							events[obj.event].write(obj, done);
						}
					}),
					ls.devnull(),
					(err) => {
						console.log(err);
						done(err);
					}
				);
			}, (err) => done(err, obj));
		}), ls.through((obj, done) => {
			checkpointData.eid = obj.eid;
			checkpointData.units += obj.units || 1;
			checkpointData.source_timestamp = obj.source_timestamp;
			checkpointData.ended_timestamp = obj.timestamp;
			checkpointData.started_timestamp = obj.timestamp;
			done();
		}), ls.devnull(), (err) => {
			if (err) {
				console.log(err);
				callback(err);
			} else {
				closeStreams((err) => {
					if (!err && checkpointData.units > 0) {
						cron.checkpoint(botId, source, checkpointData, (err) => callback(err, checkpointData.units));
					} else {
						callback(err, checkpointData.units);
					}
				});
			}
		});

		function closeStreams(callback) {
			var tasks = [];
			for (let event in events) {
				tasks.push((done) => {
					console.log("closing streams", event);
					events[event].on("finish", () => {
						console.log("got finish from stream");
						done();
					}).on("error", (err) => {
						console.log(err);
						// done(err);
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
					callback();

				}
			});
		}
	};

	let millisToExit = context.getRemainingTimeInMillis() * 0.2;
	async.doWhilst(loop, () => {
		return checkpointData.units > 0 && context.getRemainingTimeInMillis() > millisToExit;
	}, callback);
});
