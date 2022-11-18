let fs = require("fs");
let path = require("path");
let _extend = require("extend");
let extend = (a, b) => _extend(true, {}, a, b);
module.exports = function(buildDir, newCloudformation, done) {

	// Enable TTL for LeoStream Table
	// Default TTL is 7 days.  Can be overriden in the CF template
	newCloudformation.Resources.LeoStream.Properties.TimeToLiveSpecification = {
		AttributeName: "ttl",
		Enabled: true
	};

	Object.entries(newCloudformation.Resources).forEach(([key, value]) => {
		if (value.Type == "AWS::Lambda::Function") {
			value.Properties.Architectures = ["arm64"];
		}
		if (value.Type == "AWS::Lambda::Function" ||
			value.Type == "AWS::Kinesis::Stream" ||
			value.Type == "AWS::KinesisFirehose::DeliveryStream" ||
			value.Type == "AWS::DynamoDB::Table" ||
			value.Type == "AWS::S3::Bucket"
		) {
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

		if (value.Type == "AWS::DynamoDB::Table") {
			let group = `${key} Configuration`;
			let billingModeName = `${key}BillingMode`;


			//Dynamically Add Billing mode Parameters
			value.Properties.BillingMode = {
				Ref: billingModeName
			};
			newCloudformation.Parameters[billingModeName] = {
				Type: "String",
				Default: "PROVISIONED",
				AllowedValues: ["PROVISIONED", "PAY_PER_REQUEST"],
				Description: `Billing Mode for ${key} dynamodb table`,
				Group: group
			};

			// Add a condition to check if autoscaling is used
			let autoScalingConditionName = `${key}HasAutoScaling`;
			newCloudformation.Conditions[autoScalingConditionName] = {
				"Fn::Equals": [
					{
						"Ref": billingModeName
					},
					"PROVISIONED"
				]
			}

			// Dynamically add autoscaling Min/Max Read/Write Capacity parameters
			let readDefaultCapacity = {
				Properties: {
					MinCapacity: value.Properties.ProvisionedThroughput.ReadCapacityUnits || 5,
					MaxCapacity: (value.Properties.ProvisionedThroughput.ReadCapacityUnits || 5) * 10
				}
			};
			let writeDefaultCapacity = {
				Properties: {
					MinCapacity: value.Properties.ProvisionedThroughput.WriteCapacityUnits || 5,
					MaxCapacity: (value.Properties.ProvisionedThroughput.WriteCapacityUnits || 5) * 10
				}
			};
			let write = newCloudformation.Resources[`${key}WriteCapacityScalableTarget`] || writeDefaultCapacity;
			let read = newCloudformation.Resources[`${key}ReadCapacityScalableTarget`] || readDefaultCapacity;

			newCloudformation.Parameters[`${key}MinReadCapacity`] = {
				Type: "Number",
				Default: read.Properties.MinCapacity,
				Group: group
			};
			newCloudformation.Parameters[`${key}MaxReadCapacity`] = {
				Type: "Number",
				Default: read.Properties.MaxCapacity,
				Group: group
			};
			newCloudformation.Parameters[`${key}MinWriteCapacity`] = {
				Type: "Number",
				Default: write.Properties.MinCapacity,
				Group: group
			};
			newCloudformation.Parameters[`${key}MaxWriteCapacity`] = {
				Type: "Number",
				Default: write.Properties.MaxCapacity,
				Group: group
			};

			read.Properties.MaxCapacity = {
				Ref: `${key}MaxReadCapacity`
			}
			read.Properties.MinCapacity = {
				Ref: `${key}MinReadCapacity`
			}

			write.Properties.MaxCapacity = {
				Ref: `${key}MaxWriteCapacity`
			}
			write.Properties.MinCapacity = {
				Ref: `${key}MinWriteCapacity`
			}

			let writeScalePolicy = newCloudformation.Resources[`${key}WriteAutoScalingPolicy`];
			let readScalePolicy = newCloudformation.Resources[`${key}ReadAutoScalingPolicy`];

			// Attach the autoscaling condition to the autoscaling resources
			write.Condition = autoScalingConditionName;
			read.Condition = autoScalingConditionName;
			if (writeScalePolicy) {
				writeScalePolicy.Condition = autoScalingConditionName
			}
			if (readScalePolicy) {
				readScalePolicy.Condition = autoScalingConditionName
			}

			value.Properties.ProvisionedThroughput = {
				"Fn::If": [
					autoScalingConditionName, {
						ReadCapacityUnits: {
							Ref: `${key}MinReadCapacity`
						},
						WriteCapacityUnits: {
							Ref: `${key}MinWriteCapacity`
						}
					}, {
						Ref: "AWS::NoValue"
					}
				]
			};
		}
	});
	createCloudformationParameterGroups(newCloudformation);
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

function createCloudformationParameterGroups(newCloudformation) {
	const pgmap = ["Metadata", "AWS::CloudFormation::Interface", "ParameterGroupsMap"].reduce((o, k) => (o[k] = o[k] || {}), newCloudformation);
	const cfInterface = newCloudformation.Metadata["AWS::CloudFormation::Interface"];
	Object.keys(newCloudformation.Parameters || {}).forEach(k => {
		const p = newCloudformation.Parameters[k];
		if (p.Group) {
			if (!(p.Group in pgmap)) {
				pgmap[p.Group] = { Label: { default: p.Group }, Parameters: [] };
			}
			const pGroup = pgmap[p.Group];
			pGroup.Parameters.push(k);
			delete p.Group;
		}
	});
	// Convert ParameterGroupMap to the needed list
	if (cfInterface.ParameterGroupsMap) {
		cfInterface.ParameterGroups = cfInterface.ParameterGroups || [];
		cfInterface.ParameterGroups = cfInterface.ParameterGroups.concat(Object.values(cfInterface.ParameterGroupsMap));
		delete cfInterface.ParameterGroupsMap;
	}
}

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
