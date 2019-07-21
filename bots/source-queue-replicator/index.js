'use strict';

const { read, streams: ls } = require('leo-sdk');

/* 
  This is triggered from the source account
	It must reach out to the destination account/stack to get the configuration
	
	The bot should probably check the stack params to verify it is still wanted
*/
exports.handler = require("leo-sdk/wrappers/cron")(function(event, context, callback){
	const stats = ls.stats(event.botId, event.source);
	ls.pipe(
		read(event.botId, event.source),
		// ls.log(),
		stats,
		ls.devnull(),
		(err) => {
			if (err) return callback(err);			
			stats.checkpoint(callback);
		}
	);
});
