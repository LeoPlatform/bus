describe("local", function() {
	it("Should be able to read an S3 file and add it to the stream", function(done) {
		this.timeout(60000);

		process.env.resources = JSON.stringify({
			LeoS3LoadTrigger: 'Staging-LeoS3LoadTrigger-3HHI1JPE773',
			LeoS3: 'staging-leos3-kwah9bq4vk1y',
			LeoCron: 'Staging-LeoCron-P2BJYEG01WR9',
			LeoFirehoseStreamProcessor: 'Staging-LeoFirehoseStreamProcessor-1NP02OC55G54N'
		});
		process.env.aws = JSON.stringify({
			region: 'us-west-2',
			AccountId: '134898387190',
			LeoS3: 'staging-leos3-kwah9bq4vk1y'
		});

		var lambda = require("../index.js");
		lambda.handler(require("./event.json"), {}, (err) => {
			done(err);
		});
	});
});
