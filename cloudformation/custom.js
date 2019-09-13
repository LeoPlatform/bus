module.exports = {
	Resources: {
		"LeoInstall": {
			"Type": "Custom::Install",
			"Properties": {
				"ServiceToken": {
					"Fn::Sub": "${LeoInstallFunction.Arn}"
				},
				"Version": "2.0"
			},
			"DependsOn": [
				"LeoInstallFunction"
			]
		}
	}
};
