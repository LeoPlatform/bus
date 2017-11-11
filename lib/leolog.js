var cache = {
	entries: {}
};
module.exports = {
	globalOptions: undefined,
	add: function (identifier, start, end, units, duration, resource_consumption, isError, options) {
		var id = identifier;
		options = Object.assign({}, this.globalOptions, options);
		if (options && options.key) {
			identifier += "-" + options.key;
		}
		var completions = options.__completions;
		delete options.__completions;

		if (!(identifier in cache.entries)) {
			cache.entries[identifier] = {
				runs: 1,
				completions: completions || 0,
				start: start,
				end: end,
				units: units,
				duration: duration,
				max_duration: duration,
				min_duration: duration,
				consumption: resource_consumption,
				errors: isError ? 1 : 0,
				options: options,
				id: id.replace(/\n/, '')
			};
		} else {
			cache.entries[identifier].runs += 1;
			cache.entries[identifier].completions += (completions || 0);
			cache.entries[identifier].start = Math.max(start, cache.entries[identifier].start);
			cache.entries[identifier].end = Math.max(end, cache.entries[identifier].end);
			cache.entries[identifier].units += units;
			cache.entries[identifier].duration += duration;
			cache.entries[identifier].consumption += resource_consumption;
			cache.entries[identifier].max_duration = Math.max(duration, cache.entries[identifier].max_duration);
			cache.entries[identifier].min_duration = Math.min(duration, cache.entries[identifier].min_duration);
			cache.entries[identifier].errors += isError ? 1 : 0;
		}
	},
	finalize: function (addEnd, isSuccess) {
		for (var key in cache.entries) {
			var entry = cache.entries[key];
			if (!entry.options || Object.keys(entry.options).length == 0) {
				this.loggers.v1(entry);
			} else {
				this.loggers.v2(entry);
			}
		}
		if (addEnd) {
			if (!isSuccess) {
				console.log(`[LEOLOG]:ERROR`);
			}
		}
		cache.entries = {};
	},
	finalizeV2: function (extra, addEnd, isSuccess) {

		for (var key in cache.entries) {
			var entry = cache.entries[key];
			entry.options = extra;
			this.loggers.v2(entry);
		}
		if (addEnd) {
			if (!isSuccess) {
				console.log(`[LEOLOG]:ERROR`);
			}
		}
		cache.entries = {};
	},
	loggers: {
		"v1": function (entry) {
			console.log(`[LEOLOG]:v1:${entry.runs}:${entry.start}:${entry.end}:${entry.units}:${entry.duration}:${entry.min_duration}:${entry.max_duration}:${entry.consumption}:${entry.errors}:${entry.id}`);
		},
		"v2": function (entry) {
			var packed = [
				entry.runs,
				entry.start,
				entry.end,
				entry.units,
				Math.round(entry.duration),
				Math.round(entry.min_duration),
				Math.round(entry.max_duration),
				entry.consumption,
				entry.errors,
				entry.id,
				entry.completions
			]
			var data = JSON.stringify({
				p: packed,
				e: entry.options
			});
			console.log(`[LEOLOG]:v2:${data}`);
		}
	},
	systemRead: function (id, event, recordCount, opts) {
		if (typeof opts == "function") {
			callback = opts;
			opts = {};
		}
		opts = opts || {};
		if (!event.match(/\./)) {
			event = "system." + event;
		}
		var now = Date.now();
		var start = opts.event_source_timestamp || now;
		var end = opts.execution_end_timestamp || now;
		var execStart = opts.execution_start_timestamp || now;
		var duration = opts.duration || (end - execStart);

		var extra = Object.assign({}, opts.extra, {
			key: id
		});
		var packed = [
			opts.runs || 1,
			start,
			end,
			recordCount,
			duration,
			duration,
			duration,
			opts.consumption || 0,
			opts.errors || 0,
			"leo:getEvents:" + event
		];
		var data = JSON.stringify({
			p: packed,
			e: extra
		});
		console.log(`[LEOLOG]:v2:${data}`);
	},
	systemWrite: function (id, event, recordCount, opts) {
		if (typeof opts == "function") {
			callback = opts;
			opts = {};
		}
		opts = opts || {};
		if (!event.match(/\./)) {
			event = "system." + event;
		}

		var now = Date.now();
		var start = opts.event_source_timestamp || now;
		var end = opts.execution_end_timestamp || now;
		var execStart = opts.execution_start_timestamp || now;
		var duration = opts.duration || (end - execStart);

		var extra = Object.assign({}, opts.extra, {
			key: id
		});
		var packed = [
			opts.runs || 1,
			start,
			end,
			recordCount,
			duration,
			duration,
			duration,
			opts.consumption || 0,
			opts.errors || 0,
			"leo:kinesisWriteEvents:" + event
		];
		var data = JSON.stringify({
			p: packed,
			e: extra
		});
		console.log(`[LEOLOG]:v2:${data}`);
	}
};