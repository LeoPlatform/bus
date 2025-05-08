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
	}, function(err, data) {
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

	let files = event.Records.map(r => ({ bucket: r.s3.bucket.name, key: r.s3.object.key }));
	var lastKey = files[files.length - 1].key;

	console.log(files);
	var stream = leo.load("Leo_core_s3_load_trigger", "commands.s3_bus_load", {
		debug: true
	});

	stream.write({
		payload: {
			command: "load",
			files: files
		}
	});
	stream.end((err) => {
		if (err) {
			callback(err);
		} else {
			console.log("Last Key:", lastKey);
			dynamodb.saveSetting(setting_id, lastKey, function() {
				callback();
			});
		}
	});
};
