"use strict";

var leo = require("leo-sdk");
var cronLib = leo.bot;
var dynamodb = leo.aws.dynamodb;
var configuration = leo.configuration;
var moment = require("moment");
var later = require("later");
var async = require("async");

var aws = require("aws-sdk");
var CRON_TABLE = configuration.resources.LeoCron;
var LAST_SHUTDOWN_TIME = "Leo_cron_last_shutdown_time";

var pollDuration = {
	seconds: 30
};

exports.handler = function (event, context, done) {
	timerHandler(event, context, done);
};

function setup(timeouts, last_shutdown_time, done) {
	// Query the table
	dynamodb.query({
		TableName: CRON_TABLE
	}, {
			method: "scan",
			mb: 10
		}).then(function (results) {
			console.log("Got Cron Table", process.memoryUsage());
			// Set a time out for each cron
			results.Items.forEach(e => {
				try {
					var eid = e.id;
					var existing = timeouts[eid];
					if (existing) {
						if (e.time == existing.time && e.lambdaName && !e.archived) {
							return;
						}
						existing.interval.clear();
						delete timeouts[eid];
						var msg = "";
						if (e.archived) {
							msg = `, archived`
						}
						if (!e.lambdaName) {
							msg += ", empty lambdaName"
						}
						console.log(eid, e.name, `: removed ${existing.time}${msg}`);
					}
					if (e.time && e.lambdaName && !e.archived) {
						var parser = (e.time.match(/[a-z]/ig)) ? "text" : "cron";
						var sched = later.parse[parser](e.time, true);

						// Check for missed trigger while restarting
						var prev = later.schedule(sched).prev().valueOf();
						if (prev >= last_shutdown_time && !e.paused) {
							setTrigger(eid, {
								trigger: moment.now()
							}, function () {
								console.log(`${eid}: Setting Missed Trigger Status - Missed: ${prev} >= Last Shutdown: ${last_shutdown_time}`)
							});
						}

						later.schedule(sched).next(60);
						console.log(eid, e.name, `: added ${e.time}`);
						timeouts[eid] = {
							time: e.time,
							interval: later.setInterval(function () {
								setTrigger(eid, {
									trigger: moment.now()
								}, function () {
									console.log(`${eid}: Setting Trigger Status`)
								});
							}, sched)
						};
					}

					var retryQueue = `bot.${eid}.retry`;
					var retryRead = e.checkpoints && e.checkpoints.read && e.checkpoints.read[retryQueue] && e.checkpoints.read[retryQueue].checkpoint || undefined;
					var retryWrite = e.checkpoints && e.checkpoints.write && e.checkpoints.write[retryQueue] && e.checkpoints.write[retryQueue].checkpoint || undefined;
					var retryid = `__retry.${eid}`;

					if (retryWrite && (!retryRead || retryRead < retryWrite)) {
						if (!(retryid in timeouts)) {
							console.log(retryid, "*************** Retry Setup");
							// setup 1 minute timer for retries
							var time = "0 */1 * * * *";
							var sched = later.parse.cron(time, true);
							timeouts[retryid] = {
								time: time,
								interval: later.setInterval(function () {
									setTrigger(eid, {
										namedTrigger: {
											retry: moment.now()
										},
										namedSettings: {
											retry: {
												source: `bot.${eid}.retry`
											}
										}
									}, {
											merge: true
										}, function (err) {
											console.log(`${retryid}: Setting Retry Trigger Status`, err);
										});
								}, sched)
							};
						}
					} else {
						if (retryid in timeouts) {
							existing[retryid].interval.clear();
							delete timeouts[retryid];
						}
					}

				} catch (ex) {
					console.log(e)
					console.log(e.id, ex);
				}
			});
			done();
		}).catch(done);
}

function timerHandler(event, context, done) {

	var pollInterval;

	// Setup the finish timeout
	setTimeout(function () {
		console.log("Cron Shutting Down")
		pollInterval && clearInterval(pollInterval);
		for (var k in timeouts) {
			timeouts[k].interval.clear();
			console.log(`Ending ${k}`);
		}
		dynamodb.saveSetting(LAST_SHUTDOWN_TIME, moment.now(), function () {
			done();
		});
	}, context.getRemainingTimeInMillis() * .95);

	var timeouts = {};
	console.log("Timer Handler");
	dynamodb.getSetting(LAST_SHUTDOWN_TIME, function (err, time) {
		var last_shutdown_time = (err || !time) ? moment() : moment(time.value);
		if (moment() - last_shutdown_time > 300000) {
			last_shutdown_time = moment();
		}

		setup(timeouts, last_shutdown_time, (err) => {
			if (err) {
				console.log("Error setting up timers", err);
			}
		});
		console.log("Poll Milliseconds", moment.duration(pollDuration).asMilliseconds());
		pollInterval = setInterval(() => {
			console.log("Refreshing Timers");
			setup(timeouts, moment(), (err, data) => {
				if (err) {
					console.log("Error refreshing timers", err);
				}
			});
		}, moment.duration(pollDuration).asMilliseconds());
	});
}

function setTrigger(id, data, opts, callback) {
	if (typeof opts === "function") {
		callback = opts;
		opts = {};
	}
	if (opts.merge === true) {
		dynamodb.merge(CRON_TABLE, id, data, opts, callback);
	} else {
		dynamodb.update(CRON_TABLE, {
			id: id
		}, data, opts, callback);
	}
}