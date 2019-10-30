"use strict";

var leo = require("leo-sdk");
var configure = leo.configuration;
configure.update({
	kinesis: leo.configuration.resources.LeoKinesisStream,
	s3: configure.resources.LeoS3,
	firehose: " ",
});
var s3 = leo.aws.s3;
var dynamodb = leo.aws.dynamodb;


/**
 *@TODO  Put in cloud formation, S3 add trigger event source
 **/

function listFilesFromKey(bucket, lastkey, opts, callback) {
	if (typeof opts === "function") {
		callback = opts;
		opts = {};
	}

	opts = Object.assign({
		limit: 100,
		prefix: null
	}, opts);
	s3.listObjectsV2({
		Bucket: bucket,
		StartAfter: lastkey.toString(),
		MaxKeys: opts.limit,
		Prefix: opts.prefix
	}, function (err, data) {
		if (err) {
			callback(err);
		} else {
			callback(null, data.Contents);
		}
	});
}
exports.handler = (event, context, callback) => {
	var setting_id = "bus_to_s3";
	var bucket = configure.resources.LeoS3;
	var opts = {
		prefix: "firehose/"
	};
	console.log(configure);
	console.log("Triggered By Event", JSON.stringify(event));
	dynamodb.getSetting(setting_id, (err, data) => {
		if (err) {
			callback(err);
		} else {
			let position = data && data.value || "";
			console.log("Position:", position);
			listFilesFromKey(bucket, position, opts, function (err, files) {
				if (err) {
					console.log(err);
					callback(err);
				} else {
					if (files.length == 0) {
						console.log("No new Files");
						callback();
						return;
					}

					console.log(files);

					// var firstKey = files[0].Key;
					var lastKey = files[files.length - 1].Key;

					var stream = leo.load("Leo_core_s3_load_trigger", "commands.s3_bus_load", {
						debug: true
					});
					stream.write({
						payload: {
							command: "load",
							files: files.map(file => {
								return {
									bucket: bucket,
									key: file.Key
								};
							})
						}
					});
					stream.end((err) => {
						if (err) {
							callback(err);
						} else {
							dynamodb.saveSetting(setting_id, lastKey, function () {
								callback();
							});
						}
					});

					// processing.single("commands.s3_bus_load", {
					// 	command: "load",
					// 	files: files.map(file => {
					// 		return {
					// 			bucket: bucket,
					// 			key: file.Key
					// 		};
					// 	})
					// }, {
					// 	correlation_id: {
					// 		source: bucket,
					// 		start: `${firstKey}`,
					// 		end: `${lastKey}`
					// 	},
					// 	forceDynamoDB: true,
					// 	id: "Leo_core_s3_load_trigger"
					// }).then((response) => {
					// 	dynamodb.saveSetting(setting_id, lastKey, function () {
					// 		callback();
					// 	});
					// }).catch(callback);
				}
			});
		}
	});
};
