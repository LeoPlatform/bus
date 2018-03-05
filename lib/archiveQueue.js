const leo = require("leo-sdk");
const ls = leo.streams;

module.exports = function(queue) {
	let start = queue.archived_kinesis_number || 'z/0';
	let event = queue.id;
	ls.pipe(leo.read('leo-archiver', event, {
		start: start,
		limit: 1000
	}), ls.toS3GzipChunks(event, {
		useS3Mode: true,
		time: {
			minutes: 20
		},
		archive: true
	}), ls.toLeo("leo-archiver"));
};
