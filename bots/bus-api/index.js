"use strict";

let leo = require("leo-sdk");
let ls = leo.streams;
let async = require("async");

let configure = leo.configuration;
configure.update({
	kinesis: leo.configuration.resources.LeoKinesisStream,
	s3: configure.resources.LeoS3,
	firehose: configure.resources.LeoFirehoseStream,
});

let handlers = {
	start,
	end,
	read,
	write,
	checkpoint
};
exports.handler = (event, context, callback) => {
	let request = event.body || event;
	if (request.type in handlers) {
		handlers[request.type](request, context, callback);
	} else {
		callback(`Unsupported action '${request.type}'.`);
	}
};


function start(request, context, callback) {
	let start = Date.now();
	let options = Object.assign({
		requestId: context.awsRequestId
	}, request.options);

	let event = {
		id: request.id,
		__cron: {
			id: request.id,
			lock: request.options && request.options.lock,
			ts: Date.now()
		}
	};
	leo.bot.start(event, options, (err) => {
		callback(null, {
			id: request.id,
			status: err ? "error" : "success",
			error: err || undefined,
			duration: Date.now() - start,
			token: {
				requestId: event.__cron.__requestId,
				ts: event.__cron.ts
			}
		});
	});
}

function end(request, context, callback) {
	let token = request.token || {};
	configure.registry.__cron = {
		id: request.id,
		ts: token.ts,
		__requestId: token.requestId,
		forceComplete: false
	};
	let start = Date.now();

	let cp = (cb) => cb();
	console.log(request);
	if (request.checkpoint && request.checkpoint.eid) {
		cp = (cb) => {
			checkpoint(Object.assign({}, request.checkpoint, {
				id: request.id
			}), context, cb);
		};
	}

	cp((err) => {
		leo.bot.end(err || request.status, {
			id: request.id
		}, (err) => {
			console.log(`Finished Ending for '${request.id}'.`, err || "");
			callback(null, {
				id: request.id,
				status: err ? "error" : "success",
				error: err || undefined,
				duration: Date.now() - start
			});
		});
	});
}

function read(request, context, callback) {
	let start = Date.now();
	let events = [];

	if (!request.id || !request.queue) {
		return callback("Invalid parameters. 'id' and 'queue' are required.");
	}

	ls.pipe(
		leo.read(request.id, request.queue, Object.assign({
			size: 1024 * 1024 * 1
		}, request.options)),
		ls.write((event, done) => {
			events.push(event);
			done();
		}),
		(err) => {
			console.log(`Finished reading events for '${request.id}' from queue '${request.queue}'.  Events: ${events.length}`, err || "");
			callback(null, {
				id: request.id,
				queue: request.queue,
				events: !err && events,
				status: err ? "error" : "success",
				error: err || undefined,
				count: err ? undefined : events.length,
				duration: Date.now() - start
			});
		}
	);
}

function write(request, context, callback) {
	let start = Date.now();
	if (!request.id || !request.queue) {
		return callback("Invalid parameters. 'id' and 'queue' are required.");
	}

	let stream = leo.load(request.id, request.queue, request.options);
	let events = request.events || [];
	if (!Array.isArray(events)) {
		events = [events];
	}

	async.each(events, (event, done) => {
		let canWrite = stream.write(event);
		if (!canWrite) {
			stream.once("drain", () => {
				done();
			});
		} else {
			done();
		}
	}, (err) => {
		if (err) {
			return callback(null, {
				status: "error",
				error: err,
				duration: Date.now() - start
			});
		}
		stream.end((err) => {
			console.log(`Finished writing events for '${request.id}' to queue '${request.queue}'.  Events: ${events.length}`, err || "");
			callback(null, {
				id: request.id,
				queue: request.queue,
				status: err ? "error" : "success",
				error: err || undefined,
				count: err ? undefined : events.length,
				duration: Date.now() - start
			});
		});
	});
}

function checkpoint(request, context, callback) {
	let start = Date.now();
	let params = {
		eid: request.eid,
		source_timestamp: request.source_timestamp || Date.now(),
		started_timestamp: request.started_timestamp || Date.now(),
		ended_timestamp: request.ended_timestamp || Date.now(),
		units: request.units || request.records,
		force: request.force == undefined ? true : false,
		expected: request.expected,
		type: request.type
	};
	if (request.event) {
		params.eid = request.event.eid || params.eid;
		params.source_timestamp = request.event.source_timestamp || params.source_timestamp;
	}
	if (params.units == undefined) {
		params.units = 1;
	}

	leo.bot.checkpoint(request.id, request.queue, params, (err) => {
		console.log(`Finished checkpointing for '${request.id}' to queue '${request.queue}'.`, err || "");
		callback(null, {
			id: request.id,
			eid: err ? undefined : params.eid,
			status: err ? "error" : "success",
			error: err || undefined,
			duration: Date.now() - start
		});
	});
}
