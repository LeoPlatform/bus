/**
 * Reports the bot is starting.
 * Read Events from the queue 'api-queue-2' 3 at a time, transform the events, write the new events to the queue 'api-queue-3'.
 * Checkpoints the last event eid at the very end.
 * Reports the bot is ending.
 */
let async = require("async");
let aws = require("aws-sdk");
let lambda = new aws.Lambda({
	region: "us-east-1"
});
let lambdaFunctionName = "Staging-LeoBusApiProcessor-12A1GKXVBLJXL";
let api = require("./apiHelper")(lambdaFunctionName, lambda);


let id = "api-test-bot-2";
let readQueue = "api-queue-2";
let writeQueue = "api-queue-3";

api.start(id, {
	lock: true
}, (err, startData) => {
	if (err) {
		console.log("Start error:", err);
		return;
	}
	console.log("Start Data:", startData);

	let hasMore = true;
	let lastEid;
	let units = 0;
	async.doWhilst((done) => {
		api.read(id, readQueue, {
			limit: 3,
			start: lastEid // We aren't checkpointing every loop so we need to say where to start reading
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
				lastEid = e.eid;
				units++;
				return e;
			});

			api.write(id, writeQueue, events, (err, writeResponse) => {
				if (err) {
					console.log("Write Error:", err);
					return done(err);
				}
				console.log("Write Data:", writeResponse);
				done();
			});
		});
	}, () => {
		return hasMore;
	}, function ending(err) {
		let checkpoint;
		if (!err) {
			checkpoint = {
				queue: readQueue,
				eid: lastEid,
				units: units
			};
		}
		api.end(id, err, startData.token, {
			checkpoint: checkpoint
		}, (err, endData) => {
			if (err) {
				console.log("End Error:", err)
				return;
			}

			console.log("End Data", endData);
		});
	});
});