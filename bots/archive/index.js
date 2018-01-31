// "use strict";

// var dynamodb = require("../../lib/dynamodb.js");
// var moment = require("moment");
// var processing = require("../../lib/event/process.js");
// var ls = require("../../lib/stream/leo-stream.js");
// var async = require("async");
// var es = require("event-stream");
// var configure = require("../../leoConfigure.js");
// var leoStreams = require("../../lib/event/stream.js");

// // Archive Handler
// exports.handler = (settings, context, callback) => {
// 	var queue = settings.queue;
// 	dynamodb.get("Leo_event", queue, {
// 		id: "event"
// 	}, (err, data) => {
// 		if (err) {
// 			return callback(err);
// 		}

// 		//Find events that need to archive that are at least a day old
// 		var today = moment().startOf('day');
// 		var timestamp = today.valueOf();
// 		var lastData;

// 		var writeStream = ls.eventWriteStream(queue, {
// 			useS3Mode: true
// 		});
// 		var endStream = ls.pipe(writeStream,
// 			s3ArchiveStream(queue, {
// 				count: 10,
// 				checkpoint: (callback) => {
// 					if (lastData) {
// 						lastData.writeWithCheckpoint((err) => {
// 							callback(err);
// 						});
// 					} else {
// 						callback();
// 					}
// 				}
// 			}),
// 			function (err) {
// 				console.log("In Ending Function", err || "");
// 				if (lastData) {
// 					lastData.writeWithCheckpoint((err) => {
// 						callback(err);
// 					});
// 				} else {
// 					callback();
// 				}
// 			});

// 		var options = Object.assign({
// 			limit: Number.POSITIVE_INFINITY,
// 			min_time_to_leave: context.getRemainingTimeInMillis() * 0.2
// 		}, settings.loopSettings);

// 		processing.bulk(queue, options, function (event, done, data) {
// 			lastData = data;
// 			var result = writeStream.write(event);
// 			if (!result) {
// 				writeStream.once("drain", done);
// 			} else {
// 				done();
// 			}
// 		}).then(function (data) {
// 			lastData = data;
// 			console.log("Ending Write Stream");
// 			writeStream.end();
// 		}).catch(function (err, data) {
// 			console.log("ERROR IN CATCH", err, data);
// 			// TODO: end stream with an error
// 			callback(err);
// 		});
// 	});
// };

// function s3ArchiveStream(queue, opts) {
// 	opts = Object.assign({
// 		count: Number.POSITIVE_INFINITY,
// 		checkpoint: (cb) => {
// 			cb();
// 		}
// 	}, opts);

// 	var stream;
// 	var entry;
// 	var reset = function () {
// 		var now = moment();
// 		var timestamp = now.format("YYYY/MM/DD/HH");
// 		var key = `archive/${queue}/${timestamp}/${queue}-Archive-${now.valueOf()}.gz`;
// 		console.log("**** Resetting S3 Stream ****", configure.bus.s3, key);
// 		entry = {
// 			event: queue,
// 			start: null,
// 			end: null,
// 			s3: {
// 				bucket: configure.bus.s3,
// 				key: key
// 			},
// 			offsets: [],
// 			gzipSize: 0,
// 			size: 0,
// 			records: 0
// 		};
// 		stream = ls.toS3(entry.s3.bucket, entry.s3.key);
// 	}

// 	var s3Emit = function (callback) {
// 		if (!!stream && entry.records) {
// 			stream.end((err, data) => {
// 				if (err) {
// 					callback(err);
// 					return;
// 				}
// 				console.log("File End complete", err, data, JSON.stringify(entry, null, 2));
// 				dynamodb.put("Leo_archive", queue, entry, {
// 					id: "event"
// 				}, (err, data) => {
// 					if (err) {
// 						callback(err);
// 						return;
// 					}
// 					dynamodb.update("Leo_event", {
// 						event: queue
// 					}, {
// 						archive_kinesis_number: entry.end
// 					}, (err) => {
// 						if (err) {
// 							callback(err);
// 							return;
// 						}
// 						stream = null;
// 						opts.checkpoint((err) => {
// 							callback(err);
// 						});
// 					});

// 				})
// 			});
// 		} else {
// 			callback();
// 		}
// 	};
// 	return ls.write(function (data, enc, callback) {
// 		if (!stream) {
// 			reset();
// 		}
// 		var result = stream.write(data.gzip);
// 		var last = entry.offsets[entry.offsets.length - 1] || {
// 			gzipOffset: 0,
// 			gzipSize: 0
// 		};

// 		entry.offsets.push({
// 			start: data.start,
// 			end: data.end,
// 			gzipSize: data.gzipSize,
// 			gzipOffset: last.gzipOffset + last.gzipSize,
// 			size: data.size,
// 			records: data.records
// 		});
// 		entry.start = entry.offsets[0].start;
// 		entry.end = data.end;
// 		entry.gzipSize += data.gzipSize
// 		entry.size += data.size;
// 		entry.records += data.records;

// 		var done = () => {
// 			if (entry.offsets.length >= opts.count) {
// 				console.log("Emitting because of count");
// 				s3Emit((err) => {
// 					callback(err);
// 				});
// 			} else {
// 				callback();
// 			}
// 		};

// 		if (!result) {
// 			stream.once("drain", done)
// 		} else {
// 			done();
// 		}
// 	}, function flush(callback) {
// 		console.log("Emitting because of end");
// 		s3Emit((err, data) => {
// 			callback(err);
// 		});
// 	});
// }

// // Read Handler Test
// exports.handler2 = (settings, context, callback) => {
// 	var queue = settings.queue;
// 	var total = 0;
// 	var first;
// 	var last;
// 	ls.pipe(
// 		leoStreams.stream(queue, {
// 			start: settings.start || "0",
// 			limit: settings.limit,
// 			size: settings.size,
// 			loops: 50000000,
// 			debug: settings.debug || false
// 		}),
// 		ls.through(function (data, cb) {
// 			if (!first) {
// 				first = data.kinesis_number;
// 			}
// 			last = data.kinesis_number;
// 			total++;
// 			if (total % 10000 == 0) {
// 				settings.debug && console.log("***************** Read", total, "events");
// 			}
// 			cb();
// 		}, function flush(cb) {
// 			console.log("***************** Read", total, "events", first, last);
// 			cb();
// 		}),
// 		ls.devnull(),
// 		function (err) {
// 			callback(err)
// 		}
// 	);
// }