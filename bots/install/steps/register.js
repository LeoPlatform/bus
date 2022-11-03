"use strict";
const leo = require("leo-sdk");

module.exports = function(resource, data) {
	if (typeof data === "string") {
		data = JSON.parse(data);
	}
	data = fixTypes(data);

	let id = data.id ? data.id.replace(/^arn:aws:lambda:.*?:\d+:function:(.*)$/, "$1"): undefined;
	let type = data.queue ? "queue" : data.LeoRegisterType || "bot";
	delete data.LeoRegisterType;

	if (type == "bot") {
		data.paused = data.paused == undefined ? true : data.paused == true;
		return leo.bot.createBot(id, data, {
			fields: {
				paused: {
					once: true
				}
			}
		});
	} else if (type == "system") {
		return new Promise((resolve, reject) => {
			leo.aws.dynamodb.merge(leo.configuration.resources.LeoSystem, id, data, (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
		// Register a queue and its schema
	} else if(type == "queue" || data.queue) {
		
		let leo_ref = require('leo-sdk/lib/reference');

		let AWS = require('aws-sdk');
		AWS.config.update({region: leo.configuration.resources.Region});
		let s3 = new AWS.S3({apiVersion: '2006-03-01'});
		let s3Bucket = leo.configuration.resources.LeoS3;
		// console.log(`S3bucket ${resources.LeoS3}`);
		// let bucket_name = 
		// save schema to S3
		// use the bus s3 bucket
		// prefix files/bus_internal/queue_schemas/{filename}.json
		let schemaName;
		if(type == "queue" && id) {
			schemaName = leo_ref.ref(id).id;
		} else {
			schemaName = leo_ref.ref(data.queue).id;
		}

		let schemaString;
		if(data.schema) {
			// validate the schema using ajv
			valid_schema(data.schema);
			schemaString = JSON.stringify(data.schema);
		} else {
			return Promise.reject("Queue registered without a schema");
		}

		let prefix = `files/bus_internal/queue_schemas/${schemaName}.json`;
		// console.log(`ID: ${id} --- DATA: ${data}`);

		let uploadParams = {Bucket: s3Bucket, Key: prefix, Body: schemaString};

		s3.upload(uploadParams, (err,data) => {
			if (err) {
				Promise.reject(err);
			} else {
				console.log(`successfully uploaded schema to ${s3Bucket}/${prefix}`);
				Promise.resolve();
			}
		})
		
		
	} else {
		return Promise.resolve();
	}
};


let numberRegex = /^\d+(?:\.\d*)?$/;
let boolRegex = /^(?:false|true)$/i;
let nullRegex = /^null$/;
let undefinedRegex = /^undefined$/;

function fixTypes(node) {
	let type = typeof node;
	if (Array.isArray(node)) {
		for (let i = 0; i < node.length; i++) {
			node[i] = fixTypes(node[i]);
		}
	} else if (type == "object" && node !== null) {
		Object.keys(node).map(key => {
			node[key] = fixTypes(node[key]);
		});
	} else if (type == "string") {
		if (numberRegex.test(node)) {
			return parseFloat(node);
		} else if (boolRegex.test(node)) {
			return node.toLowerCase() == "true";
		} else if (nullRegex.test(node)) {
			return null;
		} else if (undefinedRegex.test(node)) {
			return undefined;
		}
	}

	return node;
}

function valid_schema(schema) {
	const Ajv = require('ajv');
	const ajv = new Ajv();
	const addFormats = require('ajv-formats');

	addFormats(ajv);

	const valid = ajv.compile(schema);
}
