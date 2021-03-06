let fs = require("fs");
let path = require("path");
let _extend = require("extend");
let extend = (a, b) => _extend(true, {}, a, b);
module.exports = function (buildDir, newCloudformation, done) {
	let legacy = require("./legacy-cloudformation.json");
	let resources = legacy.Resources;

	Object.keys(newCloudformation.Resources).map(key => {
		let override = overrides[key] || {
			id: key,
			value: {}
		};
		resources[override.id || key] = extend(newCloudformation.Resources[key], override.value);
		delete resources[override.id || key].Metadata;
	});

	legacy.Outputs = newCloudformation.Outputs;
	legacy.Mappings = newCloudformation.Mappings;

	let output = JSON.stringify(legacy, null, 2);

	output = output.replace(/\${(LeoFirehoseStream|LeoKinesisStream|LeoStream|LeoCron|LeoEvent|LeoSettings|LeoS3|)(\..*?)?}/g,
		function (r, k, a) {
			let o = overrides[k] || {
				id: k
			};
			return `\${${o.id || k}${a||""}}`;
		});

	fs.writeFileSync(path.resolve(buildDir, "legacy-cloudformation.json"), output);
	done();
};


let overrides = {
	LeoStream: {
		id: "LeoNewStream",
		value: {
			Properties: {
				TableName: "Leo_stream"
			}
		}
	},
	LeoKinesisStream: {
		id: "KinesisStream"
	},
	LeoKinesisStreamProcessorEventSource: {
		id: "KinesisStreamProcessorEventSource",
		value: {
			DependsOn: [
				"KinesisStream",
				"LeoKinesisRole",
				"LeoKinesisStreamProcessor"
			]
		}
	},
	LeoFirehoseStream: {
		id: "FirehoseStream"
	},
	LeoArchive: {
		value: {
			Properties: {
				TableName: "Leo_archive"
			}
		}
	},
	LeoEvent: {
		value: {
			Properties: {
				TableName: "Leo_event"
			}
		}
	},
	LeoS3: {
		id: "S3Bus"
	},
	LeoSettings: {
		value: {
			Properties: {
				TableName: "Leo_setting"
			}
		}
	},
	LeoCron: {
		id: "LeoCronTable",
		value: {
			Properties: {
				TableName: "Leo_cron"
			}
		}
	},
	LeoCronProcessor: {
		value: {
			"DependsOn": [
				"LeoCronTable"
			],
		}
	},
	LeoCronScheduler: {
		value: {
			"DependsOn": [
				"LeoCronTable"
			],
		}
	},
	LeoSystem: {
		value: {
			Properties: {
				TableName: "Leo_system"
			}
		}
	},
	LeoKinesisStreamProcessor: {
		value: {
			DependsOn: [
				"KinesisStream",
				"LeoKinesisRole"
			],
		}
	},
	LeoFirehoseStreamProcessor: {
		value: {
			DependsOn: [
				"FirehoseStream",
				"LeoFirehoseRole"
			],
		}
	}
};
