"use strict";
var leo = require("leo-sdk");
var AWS = require("aws-sdk");
var https = require('https');
var querystring = require('querystring');

const ID = "leo_cron_monitor";

exports.handler = function(event, context, callback) {
	refreshCredentials().then(() => {
		var loader = leo.load(ID, "monitor");
		event.Records.forEach((record) => {
			let now = record.dynamodb.ApproximateCreationDateTime * 1000;
			var newImage = {
				trigger: 0,
				invokeTime: 0
			};
			var oldImage = {
				trigger: 0,
				invokeTime: 0
			};
			if ("NewImage" in record.dynamodb) {
				newImage = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
			}
			if ("OldImage" in record.dynamodb) {
				oldImage = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
			}

			if (newImage.id == ID || newImage.ignoreMonitor === true) {
				return;
			}

			//Let's check if it started since last time
			if (newImage.instances) {
				Object.keys(newImage.instances).forEach(i => {
					var instance = newImage.instances[i];
					var oldInstance = oldImage && oldImage.instances && oldImage.instances[i];
					if (instance.completedTime && (!oldInstance || oldInstance.completedTime == undefined)) {
						var start = (oldInstance && oldInstance.invokeTime) || now;
						var end = instance.completedTime || now;
						loader.write({
							id: newImage.id,
							type: 'completed',
							ts: end,
							start: start,
							is_error: instance.status == "error"
						});
					} else if (instance.invokeTime && (!oldInstance || oldInstance.invokeTime != instance.invokeTime)) {
						var start = instance.invokeTime;
						loader.write({
							id: newImage.id,
							type: 'started',
							start: start
						});
					}
				});
			}

			// Check for Checkpoint Read Events
			if (newImage.checkpoints && newImage.checkpoints.read) {
				Object.keys(newImage.checkpoints.read).forEach(event => {
					var newCheckpoint = newImage.checkpoints.read[event];
					var oldCheckpoint = oldImage && oldImage.checkpoints &&
						oldImage.checkpoints.read && oldImage.checkpoints.read[event] &&
						oldImage.checkpoints.read[event].checkpoint;

					if (oldCheckpoint != newCheckpoint.checkpoint && typeof newCheckpoint.records != undefined) {
						loader.write({
							id: newImage.id,
							type: 'read',
							from: event,
							checkpoint: newCheckpoint.checkpoint,
							ts: newCheckpoint.ended_timestamp || now,
							units: newCheckpoint.records,
							start: newCheckpoint.started_timestamp || now,
							source_ts: newCheckpoint.source_timestamp || now
						});
					}
				});
			}

			//CHeck for Checkpoint Writes
			if (newImage.checkpoints && newImage.checkpoints.write) {
				Object.keys(newImage.checkpoints.write).forEach(event => {
					var newCheckpoint = newImage.checkpoints.write[event];
					var oldCheckpoint = oldImage && oldImage.checkpoints &&
						oldImage.checkpoints.write && oldImage.checkpoints.write[event] &&
						oldImage.checkpoints.write[event].checkpoint;
					if (oldCheckpoint != newCheckpoint.checkpoint && typeof newCheckpoint.records != undefined) {
						loader.write({
							id: newImage.id,
							type: 'write',
							to: event,
							checkpoint: newCheckpoint.checkpoint,
							ts: newCheckpoint.ended_timestamp || now,
							units: newCheckpoint.records,
							start: newCheckpoint.started_timestamp || now,
							source_ts: newCheckpoint.source_timestamp || now
						});
					}
				});
			}
		});
		loader.end(callback);
	});
};



var hasCredentials = false;

function refreshCredentials() {
	return Promise.resolve();
	if (!hasCredentials || AWS.config.credentials.needsRefresh() || AWS.config.credentials.expireTime.getTime() < (Date.now() + 60 * 5)) {
		return new Promise((resolve, reject) => {
			https.request({
				hostname: 'api.leoplatform.com',
				port: 443,
				path: '/monitorCredentials',
				method: 'POST'
			}, (res) => {
				console.log('statusCode', res.statusCode);
				console.log('headers', res.headers);
				var data = '';
				res.on('data', (d) => {
					data += d;
				});
				res.on('end', () => {
					console.log(JSON.parse(data));
					AWS.config.credentials = new AWS.CognitoIdentityCredentials({
						IdentityPoolId: data.IdentityPoolId,
						IdentityId: data.IdentityId,
						Logins: {
							'cognito-identity.amazonaws.com': data.Token
						}
					});
					AWS.config.credentials.get(resolve);
				});
			}).end(querystring.stringify({

			}));

			//This should go on the server side
			// AWS.config.update({
			// 	region: 'us-west-2'
			// });
			// var cognitoidentity = new AWS.CognitoIdentity();
			// cognitoidentity.getOpenIdTokenForDeveloperIdentity({
			// 	IdentityPoolId: 'us-west-2:aa1428e4-3b13-4dc2-ac73-e2f8c9e5a3b4',
			// 	Logins: {
			// 		'login.leo': '1'
			// 	}
			// }, (err, data) => {
			// 	//'us-west-2:aa1428e4-3b13-4dc2-ac73-e2f8c9e5a3b4',
			// });
		});
	} else {
		return Promise.resolve();
	}
}
