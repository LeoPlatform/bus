"use strict";

const https = require("https");
const url = require("url");
const logger = require('leo-logger');

function sendCustomResourceResponse(event, status, reason) {
	const result =  {
		Status: status,
		Reason: reason,
		PhysicalResourceId: event.PhysicalResourceId,
		StackId: event.StackId,
		RequestId: event.RequestId,
		LogicalResourceId: event.LogicalResourceId
	};
	logger.info(result);
	
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
  
	return new Promise((resolve, reject) => {
		var request = https.request(options, function (response) {
			logger.info("Status code: " + response.statusCode);
			logger.info("Status message: " + response.statusMessage);
			resolve(response);
		});
  
		request.on("error", function (error) {
			logger.error("send(..) failed executing https.request(..): " + error);
			reject(error);
		});
		request.write(responseBody);
		request.end();
	});
}

module.exports = sendCustomResourceResponse;
