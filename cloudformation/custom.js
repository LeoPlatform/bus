module.exports = {
	Resources: {
		"LeoInstall": {
			"Type": "Custom::Install",
			"Properties": {
				"ServiceToken": {
					"Fn::Sub": "${LeoInstallFunction.Arn}"
				},
				"Version": "3.3"
			},
			"DependsOn": [
				"LeoInstallFunction"
			]
		}
	}
};
