"use strict";
var leo = require("leo-sdk");
var dynamodb = leo.aws.dynamodb;
var configuration = leo.configuration;

var moment = require("moment");
var async = require("async");
var refUtil = require("leo-sdk/lib/reference.js");

var aws = require("aws-sdk");

var CRON_TABLE = configuration.resources.LeoCron;
var MAX_CACHE_MILLISECONDS = 1000 * 10;
var lastCacheTime = 0;
var cache = null;

exports.handler = function(event, context, done) {
	// var cnt = 0;
	// var callback = done;
	// done = function(){};
	// var mm = setInterval(function(){
	// 	if (cnt >= 1){
	// 		callback();
	// 		clearInterval(mm);
	// 		return;
	// 	}
	// 	console.log("Running", ++cnt);
	getCronTable()
		.then(cronTable => getIdsToTrigger(cronTable, event.Records))
		.then(setTriggers)
		.then(function(result) {
			console.log(`Triggered at time: ${result.time} for ids: ${JSON.stringify(result.data)}`);
			done(null, result);
		})
		.catch(done);
	//}, 500)
};

function setTriggers(results) {
	return new Promise((resolve, reject) => {
		var now = moment.now();

		async.eachLimit(results, 10, function(data, callback) {
			console.log(`Setting Cron trigger for ${data.id}, ${now}`);

			var sets = ["#trigger = :trigger"];
			var ean = {
				"#requested_kinesis": "requested_kinesis",
				"#trigger": "trigger"
			};
			var eav = {
				":trigger": moment.now()
			};

			var i = 0;
			Object.keys(data.events).forEach(function(key) {
				i++;
				var event = data.events[key];
				sets.push(`#requested_kinesis.#n_${i} = :v_${i}`);
				ean[`#n_${i}`] = key;
				eav[`:v_${i}`] = event;
			});

			var command = {
				TableName: CRON_TABLE,
				Key: {
					id: data.id
				},
				UpdateExpression: 'set ' + sets.join(", "),
				ExpressionAttributeNames: ean,
				ExpressionAttributeValues: eav,
				"ReturnConsumedCapacity": 'TOTAL'
			};

			dynamodb.docClient.update(command, callback);
		}, function(err) {
			if (err) {
				console.log(err);
				reject(err);
			} else {
				resolve({
					data: results,
					time: now
				});
			}
		});
	});
}

function getIdsToTrigger(cronTable, records) {
	var idsToTrigger = {};
	records.forEach(record => {
		if ("NewImage" in record.dynamodb) {
			var newImage = aws.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
			var oldImage = record.dynamodb.OldImage && aws.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
			var event = refUtil.refId(newImage.event);
			var newMax = max(newImage.kinesis_number, newImage.s3_kinesis_number, newImage.initial_kinesis_number, newImage.s3_new_kinesis_number, newImage.eid, newImage.max_eid);
			var oldMax = oldImage && max(oldImage.kinesis_number, oldImage.s3_kinesis_number, oldImage.initial_kinesis_number, oldImage.s3_new_kinesis_number, oldImage.eid, oldImage.max_eid);
			if (newMax != oldMax && event in cronTable) {
				cronTable[event].forEach(id => {
					idsToTrigger[id] = idsToTrigger[id] || {
						id: id,
						events: {}
					};
					idsToTrigger[id].events[event] = newMax;
				});
			}
		}
	});

	return idsToTrigger;
}

function max() {
	var max = arguments[0];
	for (var i = 1; i < arguments.length; ++i) {
		if (arguments[i] != null && arguments[i] != undefined) {
			max = max > arguments[i] ? max : arguments[i];
		}
	}
	return max;
}

function getCronTable() {
	return new Promise((resolve, reject) => {

		var now = moment.now();
		if (!cache || lastCacheTime + MAX_CACHE_MILLISECONDS <= now) {
			console.log("Looking up the Current Cron Table", now - lastCacheTime, MAX_CACHE_MILLISECONDS);
			cache = {};
			var params = {
				TableName: CRON_TABLE
			};
			dynamodb.query(params, {
				method: "scan",
				mb: 10
			}).then(function(data) {
				data.Items.forEach(item => {

					if (!item.archived && item.triggers) {
						var triggers = item.triggers;

						triggers.forEach(trigger => {
							trigger = refUtil.refId(trigger);
							if (!(trigger in cache)) {
								cache[trigger] = [];
							}
							cache[trigger].push(item.id);
						});

					}
				});
				lastCacheTime = moment.now();
				resolve(cache);
			}).catch(function(err) {
				console.log(err);
				reject(err, "Unable to get Cron Table");
			});
		} else {
			console.log("Getting Cron Table from cache");
			resolve(cache);
		}
	});
}
