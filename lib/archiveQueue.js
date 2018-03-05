const leo = require("leo-sdk");
const ls = leo.streams;
const dynamodb = leo.aws.dynamodb;
const moment = require("moment");

module.exports = function(queue) {
	let start = queue.archived_kinesis_number || 'z/0';
	let event = queue.id;


	let timestamp = moment();

	ls.pipe(leo.read('ARCHIVER', event, {
		start: start,
		limit: 1000
	}), ls.toS3GzipChunks(event, {
		useS3Mode: true,
		time: {
			minutes: 20
		},
		archive: true
	}), ls.log(), ls.devnull());

	// ls.pipe(ls.


	// 	stream, transform, ls.through((obj, done) => {
	// 	done(null, {
	// 		id: botId,
	// 		payload: obj,
	// 		checkpoint: obj.d_id,
	// 		event: event
	// 	});
	// }), ls.toS3GzipChunks(event, {
	// 	useS3Mode: true,
	// 	time: {
	// 		minutes: 1
	// 	},
	// 	prefix: "_snapshot/" + timestamp.format("YYYY/MM_DD_") + timestamp.valueOf()
	// }, function(done, push) {
	// 	push({
	// 		_cmd: 'registerSnapshot',
	// 		event: event,
	// 		start: timestamp.valueOf(),
	// 		next: timestamp.clone().startOf('day').valueOf()
	// 	});
	// 	done();
	// }), ls.toLeo(botId, {
	// 	snapshot: timestamp.valueOf()
	// }), (err) => {
	// 	console.log("all done");
	// 	console.log(err);
	// 	done(err);
	// });

};
