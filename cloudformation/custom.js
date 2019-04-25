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
            ],
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "0ffc9927-0388-44c8-b83e-b242004f6fe5"
                }
            }
        },
    }
}