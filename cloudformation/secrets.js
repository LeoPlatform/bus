module.exports = {
	// Bus Secrets were already created so we don't want to add this
	// Resources: {
	// 	StackSecret: {
	// 		Type: "AWS::SecretsManager::Secret",
	// 		Properties: {
	// 			Description: "Bus configuration",
	// 			Name: {
	// 				"Fn::Sub": "rstreams-${AWS::StackName}"
	// 			},
	// 			SecretString: {
	// 				"Fn::Sub": "{\"LeoStream\":\"${LeoStream}\",\"LeoCron\":\"${LeoCron}\",\"LeoEvent\":\"${LeoEvent}\",\"LeoSettings\":\"${LeoSettings}\",\"LeoSystem\":\"${LeoSystem}\",\"LeoS3\":\"${LeoS3}\",\"LeoKinesisStream\":\"${LeoKinesisStream}\",\"LeoFirehoseStream\":\"${LeoFirehoseStream}\",\"Region\":\"${AWS::Region}\"}"
	// 			}
	// 		}
	// 	}
	// }
}
