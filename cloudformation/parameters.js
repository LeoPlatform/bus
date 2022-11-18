module.exports = {
	Parameters: {
		LambdaInvokePolicy: {
			Type: "String",
			Default: "",
			Description: "AWS policy ARN to add to LeoCronRole.  Usefule for adding cross account invocations"
		},
		KinesisShards: {
			Type: "Number",
			MinValue: 1,
			Default: 1,
			Description: "Number of shards for LeoKinisesStream"
		},
		StreamTTLSeconds: {
			Type: "Number",
			MinValue: 1,
			Default: 604800,
			Description: "Number of seconds before LeoStream records are auto deleted"
		},
		MonitorShardHashKey: {
			Type: "Number",
			MinValue: 0,
			Default: 0,
			Description: "Explicit hash key to use for the monitor data"
		},

		KinesisStreamProcessorMemory: {
			Group: "Lambda Configuration",
			Type: "Number",
			Default: 640,
			MinValue: 128,
			MaxValue: 10240
		},
		FirehoseStreamProcessorMemory: {
			Group: "Lambda Configuration",
			Type: "Number",
			Default: 640,
			MinValue: 128,
			MaxValue: 10240
		},
		CronProcessorMemory: {
			Group: "Lambda Configuration",
			Type: "Number",
			Default: 256,
			MinValue: 128,
			MaxValue: 10240
		},
		EventTriggerMemory: {
			Group: "Lambda Configuration",
			Type: "Number",
			Default: 128,
			MinValue: 128,
			MaxValue: 10240
		},
		LeoMonitorMemory: {
			Group: "Lambda Configuration",
			Type: "Number",
			Default: 256,
			MinValue: 128,
			MaxValue: 10240
		}
	},
	Conditions: {
		HasLambdaInvokePolicy: {
			"Fn::Not": [
				{ "Fn::Equals": [{ Ref: "LambdaInvokePolicy" }, ""] }
			]
		},
	}
}
