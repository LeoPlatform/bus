/**
 * Reports that bot 'api-test-bot-1' is starting.
 * Read Events from the queue 'api-queue-1' 2 at a time, transform the events, write the new events to the queue 'api-queue-2' and checkpoints after each group.
 * Reports that bot 'api-test-bot-1' is ending.
 */
let async = require("async");
let aws = require("aws-sdk");
let lambda = new aws.Lambda({
	region: "us-east-1"
});
let lambdaFunctionName = "Staging-LeoBusApiProcessor-12A1GKXVBLJXL";
let api = require("./apiHelper")(lambdaFunctionName, lambda);

let id = "api-test-bot-1";
let readQueue = "api-queue-1";
let writeQueue = "api-queue-2";

api.start(id, {
	lock: true
}, (err, startData) => {
	if (err) {
		console.log("Start error:", err);
		return;
	}
	console.log("Start Data:", startData);

	let hasMore = true;

	async.doWhilst((done) => {
		api.read(id, readQueue, {
			limit: 2
		}, (err, readResponse) => {
			if (err) {
				console.log("read Error:", err);
				return done(err);
			}
			console.log("Read Data:", readResponse);
			hasMore = readResponse.count > 0;
			if (!hasMore) {
				return done();
			}
			let events = readResponse.events.map(e => {
				e.payload.api_write = Date.now();
				e.payload.api_data = Math.random() * 100000;
				return e;
			});

			api.write(id, writeQueue, events, (err, writeResponse) => {
				if (err) {
					console.log("Write Error:", err);
					return done(err);
				}
				console.log("Write Data:", writeResponse);

				api.checkpoint(id, readQueue, readResponse.events[readResponse.events.length - 1].eid, {
					units: events.length
				}, (err, cpData) => {
					if (err) {
						console.log("Checkpoint Error:", err)
						return done(err);
					}
					console.log("Checkpoint Data:", cpData)
					done();
				});
			});
		});
	}, () => {
		return hasMore;
	}, function ending(err) {
		api.end(id, err, startData.token, (err, endData) => {
			if (err) {
				console.log("End Error:", err)
				return;
			}

			console.log("End Data", endData);
		});
	});
});