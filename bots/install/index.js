"use strict";

const https = require("https");
const url = require("url");
const leo = require("leo-sdk");
exports.handler = (event, context, callback) => {
	console.log(event);

	function sendResponse(result) {
		console.log(result);
		var responseBody = JSON.stringify(result);
		var parsedUrl = url.parse(event.ResponseURL);
		var options = {
			hostname: parsedUrl.hostname,
			port: 443,
			path: parsedUrl.path,
			method: "PUT",
			headers: {
				"content-type": "",
				"content-length": responseBody.length
			}
		};

		var request = https.request(options, function (response) {
			console.log("Status code: " + response.statusCode);
			console.log("Status message: " + response.statusMessage);
			callback(null, result);
		});

		request.on("error", function (error) {
			console.log("send(..) failed executing https.request(..): " + error);
			callback(error);
		});
		request.write(responseBody);
		request.end();
	}


	process.on('uncaughtException', function (err) {
		console.log("Got unhandled Exception");
		console.log(err);
		sendResponse({
			Status: 'FAILED',
			Reason: 'Uncaught Exception',
			PhysicalResourceId: event.PhysicalResourceId,
			StackId: event.StackId,
			RequestId: event.RequestId,
			LogicalResourceId: event.LogicalResourceId
		});
	});


	let steps = [];

	// Handle 3rd party install requests
	let keys = Object.keys(event.ResourceProperties || {}).filter(k => k !== "ServiceToken" && k !== "Version");
	if (keys.length) {
		event.PhysicalResourceId = event.LogicalResourceId;
		steps = [];
		var register = require("./steps/register.js");
		keys.map(key => {
			let data = event.ResourceProperties[key];
			steps.push(register(key, data));
		});
	} else {
		event.PhysicalResourceId = "install";
		steps = [require('./steps/s3-load-trigger.js')(), require('./steps/add-crons.js')()];
	}

	Promise.all(steps).then(() => {
		console.log("Got success");
		sendResponse({
			Status: 'SUCCESS',
			PhysicalResourceId: event.PhysicalResourceId,
			StackId: event.StackId,
			RequestId: event.RequestId,
			LogicalResourceId: event.LogicalResourceId
		});
	}).catch((err) => {
		console.log("Got error");
		console.log(err);
		sendResponse({
			Status: 'FAILED',
			Reason: 'it failed',
			PhysicalResourceId: event.PhysicalResourceId,
			StackId: event.StackId,
			RequestId: event.RequestId,
			LogicalResourceId: event.LogicalResourceId
		});
	});
};