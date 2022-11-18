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
const CronTable = leo.configuration.resources.LeoCron;
const ttlSeconds = parseInt(process.env.ttlSeconds) || 604800; // Seconds in a week


async function setDDBValue(id, field, value, sequence, onErrorIncrementValue = 1) {

	console.time(`${id} update`);
	let returnValue = {
		sequence: sequence,
		value: value
	};
	try {

		// Update value. Assume it will work
		let dbValue = await leo.aws.dynamodb.docClient.update({
			TableName: leo.configuration.resources.LeoSettings,
			Key: {
				"id": id
			},
			ReturnValues: "ALL_NEW",
			UpdateExpression: `set #field = :value, #sequence = :sequence`,
			ExpressionAttributeNames: {
				"#field": field,
				"#sequence": "sequence"
			},
			ExpressionAttributeValues: {
				":value": value,
				":sequence": sequence
			},
			ConditionExpression: "attribute_not_exists(#field) OR #field < :value OR (#sequence = :sequence AND #field = :value)"
		}).promise();
		returnValue = dbValue.Attributes
	} catch (err) {
		console.log(id, "Got Initial Update Error:", err);
		if (err.code == "ConditionalCheckFailedException") {
			// Initial update didn't work. Add to the existing value and use that
			try {
				console.log(id, `Incrementing ${field} by ${onErrorIncrementValue}`);
				let dbValue = await leo.aws.dynamodb.docClient.update({
					TableName: leo.configuration.resources.LeoSettings,
					Key: {
						"id": id
					},
					ReturnValues: "ALL_NEW",
					UpdateExpression: `set #sequence = :sequence add #field :value`,
					ExpressionAttributeNames: {
						"#field": field,
						"#sequence": "sequence"
					},
					ExpressionAttributeValues: {
						":value": onErrorIncrementValue,
						":sequence": sequence
					},
					ConditionExpression: "#sequence <> :sequence"
				}).promise();
				returnValue = dbValue.Attributes
			} catch (err) {
				if (err.code == "ConditionalCheckFailedException") {
					// Error because this sequence failed before and was out of order
					// Just fetch the latest value
					console.log(id, `Same as prev sequence ${sequence} getting current value`);
					let dbValue = await leo.aws.dynamodb.docClient.get({
						TableName: leo.configuration.resources.LeoSettings,
						ConsistentRead: true,
						Key: {
							"id": id
						}
					}).promise();
					returnValue = dbValue.Item
				} else {
					console.log(id, "Got Increment Update Error:", err);
					throw err;
				}
			}
		} else {
			throw err;
		}
	} finally {
		console.timeEnd(`${id} update`);
	}

	if (returnValue.sequence !== sequence) {
		throw new Error(`Sequence doesn't match. new: ${sequence}, existing: ${returnValue.sequence}`)
	}
	delete returnValue.id;
	return returnValue;
}
async function deleteDDBValue(id) {
	await leo.aws.dynamodb.docClient.delete({
		TableName: leo.configuration.resources.LeoSettings,
		Key: {
			"id": id
		}
	}).promise();
}


exports.handler = function(event, context, callback) {
	let record = event.Records[0];
	let SHARDID = record.eventID.split(":")[0];
	let value = record.kinesis.approximateArrivalTimestamp * 1000;
	let sequence = record.kinesis.sequenceNumber;
	let id = `kinesis-processor-${SHARDID}`;
	setDDBValue(id, "value", value, sequence)
		.then((data) => {
			data.diff = value != data.value;
			data.attemptValue = value;
			data.attemptSeq = sequence;

			// Code uses the first records approximateArrivalTimestamp, so set it to the new value
			if (data.diff && data.value > value) {
				record.kinesis.approximateArrivalTimestamp = data.value / 1000;
			}
			console.log(`${id} IsDiff: ${data.diff} Value:`, JSON.stringify(data));
		})
		.catch((err) => {
			console.log(`${id} Error:`, err)
		})
		.finally(() => exports.handler2(event, context, callback));
};

exports.handler2 = function(event, context, callback) {
	let SHARDID = event.Records[0].eventID.split(":")[0];
	let TOTAL_SIZE = 0;
	let TOTALS = {};

	let eventsToSkip = {};
	let botsToSkip = {};

	if (process.env.skip_events) {
		eventsToSkip = process.env.skip_events.split(",").reduce((out, e) => {
			console.log(`Skipping all events to queue "${e}"`);
			out[refUtil.ref(e)] = true;
			out[e] = true;
			return out;
		}, {});
	}
	if (process.env.skip_bots) {
		botsToSkip = process.env.skip_bots.split(",").reduce((out, e) => {
			console.log(`Skipping all events from bot "${e}"`);
			out[e] = true;
			return out;
		}, {});
	}

	var timestamp = moment.utc(event.Records[0].kinesis.approximateArrivalTimestamp * 1000);
	var ttl = Math.floor(timestamp.clone().add(ttlSeconds, "seconds").valueOf() / 1000);

	var diff = moment.duration(moment.utc().diff(timestamp));
	var currentTimeMilliseconds = moment.utc().valueOf();

	var useS3Mode = false;
	if (diff.asSeconds() > 3 || event.Records.length > 100) {
		useS3Mode = true;
	}
	var events = {};
	var maxKinesis = {};
	var snapshots = {};
	var stats = {};

	let eventIdFormat = "[z/]YYYY/MM/DD/HH/mm/";
	var eventId = timestamp.format(eventIdFormat) + timestamp.valueOf();
	var recordCount = 0;

	function getEventStream(event, forceEventId, archive = null) {
		if (!(event in events)) {
			var assignIds = ls.through((obj, done) => {
				if (archive) {
					obj.end = archive.end;
					obj.start = archive.start;
				} else {
					if (forceEventId) {
						obj.start = forceEventId + "-" + (pad + recordCount).slice(padLength);
						obj.end = forceEventId + "-" + (pad + (recordCount + obj.end)).slice(padLength);
					} else {
						obj.start = eventId + "-" + (pad + recordCount).slice(padLength);
						obj.end = eventId + "-" + (pad + (recordCount + obj.end)).slice(padLength);
					}
					obj.ttl = ttl;
				}
				maxKinesis[event].max = obj.end;
				recordCount += obj.records;
				obj.v = 2;

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

				if (obj.records) {
					done(null, obj);
				} else {
					done();
				}
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

					if (event.match(/\/_archive$/)) {
						let oEvent = event.replace(/\/_archive$/, '');

						eventUpdateTasks.push({
							table: EventTable,
							key: {
								event: oEvent
							},
							set: {
								archive: {
									end: maxKinesis[event].max
								}
							}
						});
					}
					done();
				}).on("error", (err) => {
					console.log(err);
					done(err);
				});
				events[event].end();
			});
		}

		Object.keys(snapshots).forEach(event => {
			let oEvent = event.replace(/\/_snapshot$/, '');
			eventUpdateTasks.push({
				table: EventTable,
				key: {
					event: oEvent
				},
				set: {
					snapshot: snapshots[event]
				}
			});
		});

		async.parallel(tasks, (err) => {
			if (err) {
				console.log("error");
				console.log(err);
				callback(err);
			} else {
				console.log("finished writing");
				leo.aws.dynamodb.updateMulti(eventUpdateTasks, (err) => {
					if (err) {
						callback("Cannot write event locations to dynamoDB");
					} else {
						var checkpointTasks = [];
						for (let bot in stats) {
							let cronCheckpointCommand;
							let updates = [];
							let index = 0;

							function flushCurrentBotCPs() {
								if (updates.length > 0) {
									cronCheckpointCommand.UpdateExpression = `set ${updates.join(", ")}`;
									let checkpointCommand = cronCheckpointCommand;
									checkpointTasks.push(function(done) {
										console.info(JSON.stringify(checkpointCommand, null, 2));
										leo.aws.dynamodb.docClient.update(checkpointCommand, function(err, r) {
											if (!err) {
												console.log("Checkpointed in Cron Table", r);
											} else {
												// TODO: On error it should check to see if the bot id exists and try to created it if needed
												// See lib/cron.checkpoint
												console.error("Error checkpointing write, skipping.", err);
											}
											done();
										});
									});
								}
								cronCheckpointCommand = {
									TableName: CronTable,
									Key: {
										id: bot
									},
									ExpressionAttributeNames: {
										"#checkpoints": "checkpoints",
										"#type": "write"
									},
									ExpressionAttributeValues: {},
									"ReturnConsumedCapacity": 'TOTAL'
								};
								updates = [];
								index = 0;
							}

							flushCurrentBotCPs(); // Initial flush to set it all up;

							for (let event in stats[bot]) {
								let stat = stats[bot][event];

								if (index >= 50) {
									flushCurrentBotCPs();
								}

								index++;

								updates.push(`#checkpoints.#type.#event${index} = :value${index}`);
								cronCheckpointCommand.ExpressionAttributeNames[`#event${index}`] = refUtil.refId(event);
								cronCheckpointCommand.ExpressionAttributeValues[`:value${index}`] = {
									checkpoint: eventId + "-" + (pad + stat.checkpoint).slice(padLength),
									source_timestamp: stat.start,
									started_timestamp: stat.end,
									ended_timestamp: timestamp.valueOf(),
									records: stat.units
								};
								console.log("counts:", SHARDID, bot, event, stat.units);
							}
							flushCurrentBotCPs();
						}
						console.log("checkpointing");
						async.parallelLimit(checkpointTasks, 100, function(err) {
							if (err) {
								console.log(err);
								callback(err);
							} else {
								console.log("size:", SHARDID, TOTAL_SIZE, TOTALS);
								callback(null, "Successfully processed " + event.Records.length + " records.");
							}
						});
					}
				});
			}
		});
	}

	var stream = ls.parse(true);
	ls.pipe(stream, ls.through((event, callback) => {
		//We can't process it without these
		if (event._cmd) {
			if (event._cmd == "registerSnapshot") {
				snapshots[refUtil.ref(event.event + "/_snapshot").queue().id] = {
					start: "_snapshot/" + moment(event.start).format(eventIdFormat),
					next: moment(event.next).format(eventIdFormat)
				};
			}
			return callback();
		} else if (!event.event || ((!event.id || !event.payload) && !event.s3) || eventsToSkip[refUtil.ref(event.event)] || botsToSkip[event.id]) {
			return callback(null);
		}

		TOTALS[event.id] = (TOTALS[event.id] || 0) + JSON.stringify(event).length;

		let forceEventId = null;
		let archive = null;
		if (event.archive) {
			event.event = refUtil.ref(event.event + "/_archive").queue().id;
			archive = {
				start: event.start,
				end: event.end
			};
		} else if (event.snapshot) {
			event.event = refUtil.ref(event.event + "/_snapshot").queue().id;
			forceEventId = moment(event.snapshot).format(eventIdFormat) + timestamp.valueOf();
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
		if (typeof event.event_source_timestamp !== "number") {
			event.event_source_timestamp = moment(event.event_source_timestamp).valueOf();
		}
		getEventStream(event.event, forceEventId, archive).write(event, callback);
	}), ls.devnull(), function(err) {
		if (err) {
			callback(err);
		} else {
			closeStreams(callback);
		}
	});
	event.Records.map((record) => {
		TOTAL_SIZE += (typeof record.kinesis.data === "string") ? (record.kinesis.data.length || 0) : 0;
		if (record.kinesis.data[0] === 'H') {
			stream.write(zlib.gunzipSync(Buffer.from(record.kinesis.data, 'base64')) + "\n");
		} else if (record.kinesis.data[0] === 'e' && record.kinesis.data[1] === 'J') {
			stream.write(zlib.inflateSync(Buffer.from(record.kinesis.data, 'base64')) + "\n");
		} else if (record.kinesis.data[0] === 'e' && record.kinesis.data[1] === 'y') {
			stream.write(Buffer.from(record.kinesis.data, 'base64').toString() + "\n");
		}
	});
	stream.end();
};
