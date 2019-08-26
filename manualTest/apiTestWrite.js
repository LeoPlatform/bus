/**
 * Reports that bot 'api-write-bot' is starting.
 * Creates and writes events to the queue 'api-queue-1'.
 * Reports that bot 'api-write-bot' is ending.
 */
let aws = require("aws-sdk");
let lambda = new aws.Lambda({
	region: "us-west-2"
});
let lambdaFunctionName = "Staging-LeoBusApiProcessor-12A1GKXVBLJXL";
let api = require("./apiHelper")(lambdaFunctionName, lambda);

let id = "api-write-bot";
let writeQueue = "api-queue-1";

api.start(id, {
	lock: true
}, (err, startData) => {
	if (err) {
		console.log("Start error:", err);
		return;
	}
	console.log("Start Data:", startData);
	const events = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => {
		return {
			data: i,
			now: Date.now()
		};
	});
	api.write(id, writeQueue, events, (err, writeResponse) => {
		if (err) {
			console.log("Write Error:", err);
			return; //done(err); // done undefined
		}
		console.log("Write Data:", writeResponse);
		api.end(id, err, startData.token, (err, endData) => {
			if (err) {
				console.log("End Error:", err);
				return;
			}
			console.log("End Data", endData);
		});
	});
});
