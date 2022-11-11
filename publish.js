let fs = require("fs");
let path = require("path");
let _extend = require("extend");
let extend = (a, b) => _extend(true, {}, a, b);
module.exports = function(buildDir, newCloudformation, done) {

	Object.entries(newCloudformation.Resources).forEach(([key, value]) => {
		if (value.Type == "AWS::Lambda::Function") {
			value.Properties.Architectures = ["arm64"];
			value.Properties.Tags = [
				{
					"Key": "app",
					"Value": "rstreams-bus"
				},
				// TODO: Figure out how to get BusName.
				// {
				// 	"Key": "bus",
				// 	"Value": {
				// 		"Fn::Sub": "${BusName}"
				// 	}
				// },
				{
					"Key": "environment",
					"Value": {
						"Fn::Sub": "${Environment}"
					}
				},
				{
					"Key": "chub:tech:component",
					"Value": key
				},
				{
					"Key": "chub:tech:app",
					"Value": {
						"Fn::Sub": "${AWS::StackName}"
					}
				},
				{
					"Key": "chub:tech:env",
					"Value": {
						"Fn::Sub": "${Environment}"
					}
				}
			]
		}
	});
	let file = path.resolve(buildDir, newCloudformation.Outputs.LeoTemplate.Value.replace(/^.*?\/(cloudformation-.*)$/, "$1"));
	let localfile = path.resolve(__dirname, "cloudformation.json");
	let baseOutput = JSON.stringify(newCloudformation, null, 2);
	fs.writeFileSync(file, baseOutput);
	fs.writeFileSync(localfile, baseOutput);

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
		function(r, k, a) {
			let o = overrides[k] || {
				id: k
			};
			return `\${${o.id || k}${a || ""}}`;
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
