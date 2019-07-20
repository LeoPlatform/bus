/**
 * Helper module to call the lambda functions in the correct format
 * It also handles lambda errors and api response errors for callbacks
 */
module.exports = function (lambdaFunctionName, lambda) {
	function invoke(params, callback) {
		lambda.invoke(params, function (err, response) {
			if (!err && response && response.FunctionError) {
				err = JSON.parse(response.Payload);
				if (err.errorMessage) {
					err = err.errorMessage;
				}
			} else if (response && response.Payload != undefined) {
				response = JSON.parse(response.Payload);
				if (response.status === "error") {
					err = response.error;
				}
			} else {

				console.log(params, err, response);
				response = response.Payload;
			}

			callback(err, response);
		});
	}
	return {
		start: function (id, opts, callback) {
			if (typeof opts === "function") {
				callback = opts;
				opts = undefined;
			}
			invoke({
				FunctionName: lambdaFunctionName,
				InvocationType: 'RequestResponse',
				Payload: JSON.stringify({
					type: "start",
					id: id,
					options: opts
				})
			}, callback);
		},
		end: function (id, status, token, opts, callback) {
			if (typeof opts === "function") {
				callback = opts;
				opts = {};
			}
			let cp = opts.checkpoint;
			delete opts.checkpoint;
			invoke({
				FunctionName: lambdaFunctionName,
				InvocationType: 'RequestResponse',
				Payload: JSON.stringify({
					type: "end",
					id: id,
					token: token,
					status: status,
					checkpoint: cp,
					options: opts
				})
			}, callback);
		},
		read: function (id, queue, opts, callback) {
			if (typeof opts === "function") {
				callback = opts;
				opts = undefined;
			}
			invoke({
				FunctionName: lambdaFunctionName,
				InvocationType: 'RequestResponse',
				Payload: JSON.stringify({
					type: "read",
					id: id,
					queue: queue,
					options: opts
				})
			}, callback);
		},
		write: function (id, queue, events, opts, callback) {
			if (typeof opts === "function") {
				callback = opts;
				opts = undefined;
			}
			invoke({
				FunctionName: lambdaFunctionName,
				InvocationType: 'RequestResponse',
				Payload: JSON.stringify({
					type: "write",
					id: id,
					queue: queue,
					events: events,
					options: opts
				})
			}, callback);
		},
		checkpoint: function (id, queue, eid, opts, callback) {
			if (typeof opts === "function") {
				callback = opts;
				opts = {};
			}
			invoke({
				FunctionName: lambdaFunctionName,
				InvocationType: 'RequestResponse',
				Payload: JSON.stringify({
					type: "checkpoint",
					id: id,
					eid: eid,
					queue: queue,
					source_timestamp: opts.source_timestamp,
					started_timestamp: opts.started_timestamp,
					ended_timestamp: Date.now(),
					units: opts.units,
					force: true,
					options: opts
				})
			}, callback);
		}
	};
};
