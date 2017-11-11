describe("local", function() {
	it("Should be able to read an S3 file and add it to the stream", function(done) {
		this.timeout(60000);
		process.env.resources = JSON.stringify({
			LeoStream: 'Staging-LeoStream-1RXA45W93PBKT',
			LeoEvent: 'Staging-LeoEvent-RDAZ0DFZD7F5',
			LeoCron: 'Staging-LeoCron-P2BJYEG01WR9',

		});
		var lambda = require("../index.js");
		lambda.handler(require("./event.json"), {}, () => {

		});
	});
});