"use strict";

var leo = require("leo-sdk");
var cronLib = leo.bot;
var dynamodb = leo.aws.dynamodb;
var configuration = leo.configuration;

var moment = require("moment");
var async = require("async");
var leolog = require("../../lib/leolog");

var diff = require("deep-diff");
var aws = require("aws-sdk");

var lambda = new aws.Lambda({
	region: configuration._meta.region
});
var stepfunctions = new aws.StepFunctions({
	region: configuration._meta.region
});

var CRON_TABLE = configuration.resources.LeoCron;

var executionTypes = {
	"step-function": "step-function",
	"stepfunction": "step-function",
	"lambda": "lambda"
};

var pollDuration = {
	seconds: 30
};

exports.handler = function(event, context, done) {
	triggerHandler(event, context, done);
};

function triggerHandler(event, context, done) {
	console.log("Trigger Handler");

	var all = [];
	var setup = [];
	var cache = {
		_instances: {},
		_db: {}
	};

	if (event.Records.length >= 200) {
		setup.push(function(done) {
			console.log("Looking up the Current Cron Table", event.Records.length)
			var params = {
				TableName: CRON_TABLE
			}
			dynamodb.query(params, {
				method: "scan"
			}).then(function(data) {
				data.Items.forEach(item => {
					cache._db[item.id] = item.instances;
				});
				done();
			}).catch(function(err) {
				console.log(err);
				done();
			});
		});
	}

	event.Records.forEach(record => {
		setup.push(function(testDone) {
			var newImage = {
				trigger: 0,
				invokeTime: 0
			};
			var oldImage = {
				trigger: 0,
				invokeTime: 0
			};

			if ("NewImage" in record.dynamodb) {
				newImage = aws.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
			}
			if ("OldImage" in record.dynamodb) {
				oldImage = aws.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
			}

			var diffArray = diff(oldImage, newImage) || [];
			var diffs = (diffArray).map(e => `${e.path.join(".")}: ${e.lhs || (e.item && e.item.lhs)}, ${e.rhs || (e.item && e.item.rhs)}`);
			console.log(newImage.id, "Changes", JSON.stringify(diffs, null, 2));

			doLogging(oldImage, newImage, diffArray);

			cache._instances[newImage.id] = Object.assign(cache._instances[newImage.id] || {}, newImage.instances, cache._db[newImage.id]);
			shouldRun(oldImage, newImage, cache, function(result) {
				if (result && result.value) {
					oldImage.timedout = result.timedout;
					let addToCache = newImage.executionType && executionTypes[newImage.executionType] == "step-function";
					cronLib.buildPayloads(newImage, oldImage).then(payloads => {
						payloads.forEach(payload => {
							all.push(invokeLambda(oldImage, newImage, payload));
							if (addToCache) {
								cache[newImage.lambdaName].data.executions.push({
									name: `${payload.__cron.id}-${payload.__cron.iid.toString()}-${payload.__cron.ts}`
								});
							}
							cache._db[newImage.id] = Object.assign(cache._db[newImage.id] || {}, {
								[payload.__cron.iid.toString()]: {
									token: payload.__cron.ts,
									invokeTime: moment.now(),
									completedTime: 0
								}
							});
						});

						testDone();
					}).catch(err => {
						console.log(newImage.id, "Failure building payloads", err);
						testDone();
					});

					return;
				} else if (result && Array.isArray(result)) {
					console.log("Invoking from array")
					var passed = result.filter(r => r.value);
					if (passed.length) {
						var toRun = passed.reduce((l, r) => (l[r.iid] = r) && l, {});
						let addToCache = newImage.executionType && executionTypes[newImage.executionType] == "step-function";
						cronLib.buildPayloads(newImage, oldImage, {
							instances: Object.keys(toRun)
						}).then(payloads => {
							payloads.forEach(payload => {
								all.push(invokeLambda(Object.assign({
									timedout: toRun[payload.__cron.iid].timedout,
								}, oldImage), newImage, payload));
								if (addToCache) {
									cache[newImage.lambdaName].data.executions.push({
										name: `${payload.__cron.id}-${payload.__cron.iid.toString()}-${payload.__cron.ts}`
									});
								}
								cache._db[newImage.id] = Object.assign(cache._db[newImage.id] || {}, {
									[payload.__cron.iid.toString()]: {
										token: payload.__cron.ts,
										invokeTime: moment.now(),
										completedTime: 0
									}
								});
							});
							testDone();
						}).catch(err => {
							console.log(newImage.id, "Failure building payloads", err);
							testDone();
						});
						return;
					}
				}
				testDone();
			});
		});
	});

	async.series(setup, function(err, data) {
		async.parallelLimit(all, 20, function(err, data) {
			if (err) {
				console.log(err)
			}
			done(null, data);
		})
	});
}

function shouldRun(oldImage, newImage, cache, callback) {

	var delay = newImage.delay && moment.duration(newImage.delay).asMilliseconds() || 0;
	var completedTime = 0;
	var isRunning = false;
	var timeout = 0;
	var invokeTime = newImage.invokeTime || 0;
	var instances = cache._instances[newImage.id];

	//console.log(`Type: ${newImage.executionType}, ${newImage.executionType && executionTypes[newImage.executionType]}`);
	//console.log(JSON.stringify(newImage, null, 2));
	if ((newImage.errorCount > 10 && (Date.now() - invokeTime) < 300000) || (newImage.paused && !newImage.ignorePaused) || !newImage.lambdaName) {
		console.log(`${newImage.id} - ${newImage.name}
            passes: false

            !paused: ${!newImage.paused}
			lambdaName: ${newImage.lambdaName}
			`);
		callback({
			value: false
		})
	} else if (newImage.executionType && executionTypes[newImage.executionType] == "step-function") {

		var moreToDo = hasMoreToDo(oldImage, newImage);

		function getExecutions(err, data) {
			if (err) {
				console.log(newImage.id, err, err.stack);
				callback({
					value: false
				});
			} else {
				let i = Object.keys(instances).map(ii => `${newImage.id}-${ii}-${instances[ii].token}`);
				isRunning = data.executions.filter(e => i.indexOf(`${e.name}`) >= 0).length > 0;
				timeout = newImage.timeout || (1000 * 60 * 30); // 30 minutes

				var result = (
					(!isRunning || (invokeTime + timeout < moment.now()))
				)

				console.log(`${newImage.id} - ${newImage.name}
                    passes: ${result}

                    !paused: ${!newImage.paused} || ignorePaused: ${!!newImage.ignorePaused}
                    (!running: ${!isRunning} or timedout: ${invokeTime + timeout < moment.now()})
                    (triggered: ${newImage.trigger > (invokeTime + delay)})

                    invokeTime: ${invokeTime}
                    completedTime: ${completedTime}`)

				callback({
					value: result,
					timedout: invokeTime + timeout < moment.now()
				});
			}
		}

		var params = {
			stateMachineArn: newImage.lambdaName,
			statusFilter: 'RUNNING'
		};
		var key = newImage.lambdaName;
		if (newImage.trigger <= (invokeTime + delay) && (!moreToDo)) {
			console.log("Not triggered")
			callback({
				value: false
			});
		} else if (key in cache) {
			console.log("Get Step Function Executions from Cache");
			let cachedList = cache[key];
			getExecutions(cachedList.error, cachedList.data);
		} else {
			console.log("Get Step Function Executions from AWS");
			stepfunctions.listExecutions(params, function(err, data) {
				console.log(JSON.stringify(params, null, 2))
				console.log(JSON.stringify(data, null, 2))
				cache[key] = {
					error: err,
					data: data
				};
				getExecutions(err, data);
			});
		}

	} else if (newImage.namedTrigger) {
		// Add Default Trigger at index 0
		newImage.namedTrigger["0"] = Math.max(newImage.namedTrigger["0"] || 0, newImage.trigger || 0);
		var sync = true;
		var anyRunning = false;
		var results = Object.keys(newImage.namedTrigger).map(key => {
			var source = (newImage.namedSettings && newImage.namedSettings[key] && newImage.namedSettings[key].source) || (newImage.lambda && newImage.lambda.settings && newImage.lambda.settings[0] && newImage.lambda.settings[0].source) || undefined;
			var moreToDo = hasMoreToDo(oldImage, newImage, source);
			let trigger = newImage.namedTrigger[key];
			let instance = instances[key] || {};
			let isRunning = instances[key] && !instance.completedTime;
			let completedTime = instance.completedTime || 0;
			let timeout = instance.maxDuration || newImage.timeout || 300000; // 300000 = 5 minutes, the max lambda timeout;
			let invokeTime = instance.invokeTime || 0;
			let sameToken = instance.token == trigger;

			anyRunning = anyRunning || isRunning;
			var now = moment.now();
			var result = (
				(!isRunning || (invokeTime + timeout < now)) &&
				newImage.lambdaName &&
				(!sameToken || moreToDo) &&
				(
					trigger > (invokeTime + delay) || moreToDo
				)
			)

			console.log(`${newImage.id} - ${newImage.name} - ${key}
            passes: ${result}

			!paused: ${!newImage.paused} || ignorePaused: ${!!newImage.ignorePaused}
            (!running: ${!isRunning} or timedout: ${invokeTime + timeout < now})
			(!sameToken: ${!sameToken} or moreToDo: ${moreToDo})
            (triggered: ${trigger > (invokeTime + delay)} or moreToDo: ${moreToDo})

            invokeTime: ${invokeTime}
            completedTime: ${completedTime}
			trigger: ${trigger}
			instanceToken: ${instance.token}
			`)

			return {
				iid: key,
				value: result,
				timedout: invokeTime + timeout < now,
				lastInvoke: invokeTime
			};

		});

		if (sync) {
			var first = true;
			results = results.sort((a, b) => a.lastInvoke - b.lastInvoke).map(a => {
				if (a.value) {
					a.value = a.value && first;
					first = false;
				}
				return a;
			});
		}
		callback(results);

	} else {

		var sameToken = false;
		for (var i in instances) {
			let instance = instances[i];
			isRunning = isRunning || !instance.completedTime;
			completedTime = Math.max(completedTime, instance.completedTime || 0);
			timeout = Math.max(timeout, instance.maxDuration || 0);
			invokeTime = Math.max(invokeTime, instance.invokeTime || 0);
			//console.log(`TOKEN: ${instance.token}`)
			sameToken = sameToken || instance.token == newImage.trigger;
		}

		timeout = timeout || newImage.timeout || 300000; // 300000 = 5 minutes, the max lambda timeout
		var now = moment.now();
		var moreToDo = hasMoreToDo(oldImage, newImage)
		var result = (
			(!isRunning || (invokeTime + timeout < now)) &&
			newImage.lambdaName &&
			(!sameToken || moreToDo) &&
			(
				newImage.trigger > (invokeTime + delay) || moreToDo
			)
		)
		// console.log(`${newImage.id} - ${newImage.name}`)
		// console.log(`Timeout: ${timeout}`);
		// console.log(`Delay: ${delay}`);
		// console.log(`Trigger: ${newImage.trigger}, ${moment(newImage.trigger).format()}`)
		// console.log(`Completed: ${completedTime}, ${moment(completedTime).format()}`)
		// console.log(`Invoke: ${invokeTime}, ${moment(invokeTime).format()}`)
		// console.log(`Invoke + delay: ${invokeTime + delay}, ${moment(invokeTime + delay).format()}`)
		console.log(`${newImage.id} - ${newImage.name}
            passes: ${result}

			!paused: ${!newImage.paused} || ignorePaused: ${!!newImage.ignorePaused}
            (!running: ${!isRunning} or timedout: ${invokeTime + timeout < now})
			(!sameToken: ${!sameToken} or moreToDo: ${moreToDo})
            (triggered: ${newImage.trigger > (invokeTime + delay)} or moreToDo: ${moreToDo})

            invokeTime: ${invokeTime}
            completedTime: ${completedTime}
			trigger: ${newImage.trigger}
			`)
		callback({
			value: result,
			timedout: invokeTime + timeout < now
		});
	}
}

function hasMoreToDo(oldImage, newImage, key) {
	var reads = newImage && newImage.checkpoints && newImage.checkpoints.read || {};
	//console.log(JSON.stringify(newImage, null, 2));
	let allowed = {}
	if (key) {
		allowed = {
			[key]: true
		};
	} else if (newImage.triggers && !newImage.ignoreHasMore) {
		newImage.triggers.map(q => {
			allowed[q] = true
		});
	}
	return newImage &&
		newImage.requested_kinesis &&
		Object.keys(newImage.requested_kinesis).filter(k => allowed[k]).reduce((result, event) => {
			var latest = newImage.requested_kinesis[event];
			var checkpoint = reads[event];
			//console.log(`${event}, ${result}, ${JSON.stringify(checkpoint)}, ${latest}`)
			return result || !checkpoint || (latest > checkpoint.checkpoint);
		}, false) || false;
}

function invokeLambda(lastCron, cron, payload) {
	var index = payload.__cron.iid;

	if (lastCron.timedout) {
		console.log(cron.id, payload.__cron.iid, "Logging Timeout Error");
		logComplete({
			id: cron.id,
			invokeTime: cron.invokeTime,
			instances: {
				[index]: {
					completedTime: moment.now(),
					status: "error"
				}
			}
		}, index);
	}
	return function(done) {
		var setCheckpoint = function(checkpoint, callback) {
			//console.log(`${cron.id} checkpoint?`, checkpoint, cron.lambda.settings)
			if (!!checkpoint && cron.lambda.settings) {

				var errors = [];
				var settings = cron.lambda.settings;
				if (!Array.isArray(settings)) {
					settings = [settings];
				}
				var tasks = [];
				settings.forEach(setting => {
					if (setting.source) {
						tasks.push(function(done) {
							console.log("Updating Checkpoint for bot ", cron.id, setting.source, checkpoint);
							cronLib.checkpoint(cron.id, setting.source, {
								kinesis_number: checkpoint,
								force: true
							}, function(err) {
								if (err) {
									errors.push(err);
								}
								done();
							});
						});
					}
				});
				async.series(tasks, function(err) {
					callback(errors.length ? errors : null);
				});
			} else {
				callback();
			}
		}

		setCheckpoint(cron.checkpoint, function(err) {
			if (err) {
				console.log(cron.id, err);
				console.log("Error Setting checkpoint for " + cron.id + " to value " + cron.checkpoint);
				done();
				return;
			}
			var newInvokeTime = moment.now();
			var command = {
				TableName: CRON_TABLE,
				Key: {
					id: payload.botId
				},
				UpdateExpression: 'set #instances.#index = :value, #invokeTime = :invokeTime remove #checkpoint, #ignorePaused',
				ExpressionAttributeNames: {
					"#instances": "instances",
					"#index": index.toString(),
					"#invokeTime": "invokeTime",
					"#checkpoint": "checkpoint",
					"#ignorePaused": "ignorePaused"
				},
				ExpressionAttributeValues: {
					":value": {
						token: payload.__cron.ts,
						requestId: undefined,
						startTime: undefined,
						invokeTime: newInvokeTime,
						//log: (cron && cron.instances && cron.instances[index] && cron.instances[index].log) || null,
						status: (cron && cron.instances && cron.instances[index] && cron.instances[index].status) || null
					},
					":invokeTime": newInvokeTime
				},
				"ReturnConsumedCapacity": 'TOTAL'
			};
			if (lastCron) {
				//if (lastCron.invokeTime != undefined) {
				if (lastCron.instances && lastCron.instances[index] && lastCron.instances[index].invokeTime) {
					command.ConditionExpression = '#instances.#index.#invokeTime = :lastInvokeTime';
					command.ExpressionAttributeValues[":lastInvokeTime"] = lastCron.instances[index].invokeTime;
				} else {
					command.ConditionExpression = 'attribute_not_exists(#instances.#index.#invokeTime)';
				}
			}

			//console.log(JSON.stringify(payload, null, 2));
			//console.log(JSON.stringify(command, null, 2));

			console.log(`${cron.id} - ${cron.name} - ${payload.__cron.iid} Adding lock`)
			dynamodb.docClient.update(command, function(err) {
				if (err) {
					console.log(`${cron.id} - ${cron.name} - ${payload.__cron.iid}`, err, command);
					console.log(`${cron.id} - ${cron.name} - ${payload.__cron.iid} Failed to Create Lock`);
					done();
				} else {
					cron.invokeTime = newInvokeTime;
					logStart(cron);
					if (cron.executionType && executionTypes[cron.executionType.toLowerCase()] == "step-function") {
						payload.__cron.type = "step-function";
						let params = {
							stateMachineArn: cron.lambdaName,
							input: JSON.stringify(payload),
							name: `${cron.id}-${index.toString()}-${payload.__cron.ts}`
						};
						console.log(`${cron.id} - ${cron.name} - ${payload.__cron.iid} Invoking StateMachine with params:`)
						console.log(cron.id, payload.__cron.iid, JSON.stringify(params, null, 2));
						stepfunctions.startExecution(params, function(err, data) {
							if (err) {
								console.log(`${cron.id} - ${cron.name} - ${payload.__cron.iid} `, err);
								cronLib.reportComplete(payload.__cron, undefined, "error", err, {}, () => {
									done();
								});
							} else {
								console.log(cron.id, payload.__cron.iid, JSON.stringify(data, null, 2));
								done(err, data);
							}
						});
					} else {
						let params = {
							FunctionName: cron.lambdaName,
							InvocationType: 'Event',
							Payload: JSON.stringify(payload),
							Qualifier: cron.lambda && cron.lambda.qualifier
						};
						console.log(`${cron.id} - ${cron.name} - ${payload.__cron.iid} Invoking Lambda with params:`)
						console.log(cron.id, payload.__cron.iid, JSON.stringify(params, null, 2));

						var lambdaApi = lambda;
						var match = params.FunctionName.match(/^arn:aws:lambda:(.*?):/)
						if (match && match[1] != lambda.config.region) {
							lambdaApi = new aws.Lambda({
								region: match[1]
							});
						}
						lambdaApi.invoke(params, function(err, data) {
							if (err) {
								console.log(`${cron.id} - ${cron.name} - ${payload.__cron.iid} `, err);
								cronLib.reportComplete(payload.__cron, undefined, "error", err, {}, () => {
									done();
								});
							} else {
								console.log(cron.id, payload.__cron.iid, JSON.stringify(data, null, 2));
								done(err, data);
							}
						});
					}
				}
			});
		});
	}
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

function doLogging(oldImage, newImage, diff) {

	// Check for start and end Events
	if (newImage.instances) {
		Object.keys(newImage.instances).forEach(i => {
			var instance = newImage.instances[i];
			var oldInstance = oldImage && oldImage.instances && oldImage.instances[i];
			if (instance.completedTime && (!oldInstance || oldInstance.completedTime == undefined)) {
				logComplete(newImage, i);
			}
			// else if (instance.startTime && (!oldInstance || oldInstance.startTime == undefined)){
			// 	logStart(newImage, i);
			// }
		});
	}

	// Check for Checkpoint Events
	if (newImage.checkpoints && newImage.checkpoints.read) {
		Object.keys(newImage.checkpoints.read).forEach(event => {
			var newCheckpoint = newImage.checkpoints.read[event];
			var oldCheckpoint = oldImage && oldImage.checkpoints &&
				oldImage.checkpoints.read && oldImage.checkpoints.read[event] &&
				oldImage.checkpoints.read[event].checkpoint;

			// console.log(`${newImage.id} ${event} OLD: ${oldCheckpoint}, NEW: ${newCheckpoint.checkpoint} Records: ${newCheckpoint.records}`)
			if (oldCheckpoint != newCheckpoint.checkpoint && typeof newCheckpoint.records != undefined) {
				logCheckpoint(newImage, event, newCheckpoint);
			}
		});
	}

	if (newImage.checkpoints && newImage.checkpoints.write) {
		Object.keys(newImage.checkpoints.write).forEach(event => {
			var newCheckpoint = newImage.checkpoints.write[event];
			var oldCheckpoint = oldImage && oldImage.checkpoints &&
				oldImage.checkpoints.write && oldImage.checkpoints.write[event] &&
				oldImage.checkpoints.write[event].checkpoint;

			// console.log(`${newImage.id} ${event} OLD: ${oldCheckpoint}, NEW: ${newCheckpoint.checkpoint} Records: ${newCheckpoint.records}`)
			if (oldCheckpoint != newCheckpoint.checkpoint && typeof newCheckpoint.records != undefined) {
				logWriteCheckpoint(newImage, event, newCheckpoint);
			}
		});
	}
}

function logStart(cron) {
	var start = cron.invokeTime;
	leolog.add("Execution", start, start, 1, 0, 0, false, {
		key: cron.botId || cron.id
	});
	leolog.finalize();
}

function logComplete(cron, instanceId) {
	var instance = cron.instances[instanceId];
	var start = cron.invokeTime;
	var end = instance.completedTime;

	var isError = instance.status == "error";
	leolog.add("Execution", start, end, 0, end - start, 0, isError, {
		key: cron.botId || cron.id,
		__completions: isError ? 0 : 1
	});
	leolog.finalize();
}

function logCheckpoint(cron, event, params) {
	var end = params.ended_timestamp || moment.now();
	leolog.add(`leo:getEvents:${event}`, params.source_timestamp || end, end, params.records || 0, end - (params.started_timestamp || end), 0, null, {
		key: cron.botId || cron.id,
		checkpoint: params.checkpoint,
		s: params.started_timestamp
	});
	leolog.finalize();
}

function logWriteCheckpoint(cron, event, params) {
	var end = params.ended_timestamp || moment.now();
	leolog.add(`leo:kinesisWriteEvents:${event}`, params.source_timestamp || end, end, params.records || 0, end - (params.started_timestamp || end), 0, null, {
		key: cron.botId || cron.id,
		checkpoint: params.checkpoint,
		s: params.started_timestamp
	});
	leolog.finalize();
}