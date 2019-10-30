var lambda = require("../index.js");
describe("local", function() {
	it("Should schedule and set cron triggers", function(done) {
		this.timeout(300000);
		lambda.handler(require("./events.json"), {}, done);
	});
});
