const archiver = require("../lib/archiveQueue.js");


describe('Event', function() {
	it('Should be able to archive queues', function() {
		this.timeout(1000 * 30);
		archiver({
			id: 'monitor',
			start: null
		}, () => {

		});
	});
});
