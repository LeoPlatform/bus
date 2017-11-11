describe("local", function() {
	it("Should be able to process kinesis events", function(done) {
		this.timeout(60000);

		process.env.resources = JSON.stringify({
			LeoStream: 'Staging-LeoStream-1RXA45W93PBKT',
			LeoEvent: 'Staging-LeoEvent-RDAZ0DFZD7F5'
		});
		var lambda = require("../index.js");
		lambda.handler(require("./events.json"), {}, () => {
			console.log("done");
			done();
		});
	});
});