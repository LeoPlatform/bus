"use strict";
const leo = require("leo-sdk");
const ls = leo.streams;
const logger = require('leo-logger')('leo-archive');
const dynamodb = leo.aws.dynamodb;
const async = require("async");
const moment = require("moment");
const merge = require("lodash.merge");
const lib = require("./lib");

const EventTable = leo.configuration.resources.LeoEvent;

const GlobalSettingId = "Leo_Core_archive_global_settings";


// Default LeoStream TTL is 7 days
// default archive up to the start of half the TTL
const ttlSeconds = parseInt(process.env.ttlSeconds) || 604800; // Seconds in a week
const archiveBufferSeconds = ttlSeconds / 2;

const queueRegexMatch = process.env.queueRegexMatch && lib.parseRegex(process.env.queueRegexMatch);

const defaultStartingEid = process.env.defaultEID || "z/0";

let ReturnRemovedData = false;
/**
 * Read All queues and archive/compress the events into S3 files ~100MB
 * 
 * Notes:
 * 		The Kinesis Processor handles adding the `/_archive` to the event name 
 * 		as long as the emitted kinesis record has `archive: true` on the event
 * 		this is why `archive: true` is passed to `ls.toS3GzipChunks`
 * 
 * 
 * Should we add a list of the fields removed during archive
 */
exports.handler = require("leo-sdk/wrappers/cron")(async (settings, context, callback) => {

	// Store this in Settings table?? or just with the bot?
	const globalArchiveSettings = (await new Promise((resolve, reject) => leo.aws.dynamodb.getSetting(GlobalSettingId, (e, d) => e ? reject(e) : resolve(d)))) || {};
	settings.archive_options = merge({}, settings.archive_options, globalArchiveSettings.value);

	logger.log(settings);
	let parallelLimit = process.env.parallelLimit || settings.parallelLimit || 5;
	let exit = false;

	let timeout = setTimeout(() => {
		exit = true;
	}, context.getRemainingTimeInMillis() * 0.5);

	let cb = callback;
	callback = (err, data) => {
		clearTimeout(timeout);
		cb(err, data);
	};

	let stopTime = moment().add(context.getRemainingTimeInMillis() * 0.7, "milliseconds");

	dynamodb.scan(EventTable, null, (err, data) => {

		let maxEidToArchive = moment().add({ seconds: -archiveBufferSeconds }).format("[z]/YYYY/MM/DD");
		logger.log("Max EID to Archive:", maxEidToArchive);
		let tasks = [];

		data.map(q => {
			q.archive = Object.assign({
				end: defaultStartingEid
			}, q.archive);
			return q;
		})
			.sort((a, b) => a.archive.end.localeCompare(b.archive.end))
			.forEach(queue => {
				if (queue.archived == true || queue.skip_archive == true || queue.event.match(/\/_snapshot$/) || queue.event.match(/\/_archive$/)) {
					(queue.archived == true || queue.skip_archive == true) && logger.info(queue.event, "Skipped.", `Skip Flag: ${queue.skip_archive || false}, Archvied: ${queue.archived || false}`);
					return;
				} else if (queueRegexMatch && !queue.event.match(queueRegexMatch)) {
					logger.info(queue.event, "Skipped.", `Didn't match: ${queueRegexMatch}`);
					return;
				}

				logger.log(queue.event, "Starting Processing");
				if (queue.max_eid &&
					(!queue.archive ||
						(queue.archive.end != queue.max_eid && queue.archive.end != maxEidToArchive && maxEidToArchive.localeCompare(queue.archive.end) > 0)
					)
				) {

					let archive_options;
					if (queue.archive_options) {
						archive_options = queue.archive_options;
					} else {
						archive_options = settings.archive_options;
					}
					logger.log(queue.event, "queue start: ", (queue.archive || {}).end || defaultStartingEid);
					tasks.push(done => {
						if (exit) {
							logger.info(queue.event, "Not enough remaining time to run");
							return done();
						}
						logger.log(queue.event, "Starting to read");

						ls.pipe(
							leo.read(context.botId, queue.event, {
								start: queue.archive.end || defaultStartingEid,
								loops: Number.POSITIVE_INFINITY,
								stopTime: stopTime,
								maxOverride: maxEidToArchive
							}),
							cleanQueueStream(queue.event, archive_options || {}),
							ls.counter(queue.event),
							ls.toS3GzipChunks(queue.event, {
								useS3Mode: true,
								time: {
									minutes: 20
								},
								archive: true
							}),
							!settings.dont_submit ? ls.toLeo(context.botId) : ls.through((data, done) => done(null, data)),
							ls.devnull(),
							(err) => {
								logger.info(queue.event, "Complete", err || "");
								done(err);
							}
						);
					});
				} else {
					logger.info(queue.event, "Complete");
				}
			});

		logger.log("Running Tasks");
		async.parallelLimit(tasks, parallelLimit, (err) => {
			err && logger.error(err);
			logger.log("Tasks Done");
			callback(err);
		});
	});
});


function cleanQueueStream(label, opts = {}) {
	opts = Object.assign({}, opts);

	let regexPathMatches = Object.values(opts.path_regex || {}).map(lib.parseRegex);
	let pathMatches = Object.values(opts.paths || {});

	logger.log(label, "Regex Paths Matches:", regexPathMatches);
	logger.log(label, "Paths Matches:", pathMatches);

	return ls.through((data, done) => {
		let removedPaths = {};

		let cleaned = data.payload;

		// Remove all static path matches
		if (pathMatches.length > 0) {
			for (let i = 0; i < pathMatches.length; i++) {
				let removed = lib.removePath(cleaned, pathMatches[i], "", ReturnRemovedData);
				Object.assign(removedPaths, removed);
			}
		}

		// Remove all regex path matches
		if (regexPathMatches.length > 0) {
			cleaned = lib.visit(cleaned, key => key, (data, path) => {
				const isPathMatch = regexPathMatches.some(m => path.match(m));
				if (isPathMatch) {
					if (data != null) {
						removedPaths[path] = ReturnRemovedData ? data : null;
						logger.debug(label, "Regex removed path", path);
					}
					return null;
				} else {
					return data;
				}
			});
		}

		data.payload = cleaned;
		data.archived = true;
		data.archive_removed_fields = Object.keys(removedPaths);

		logger.debug(label, "Removed Data:", JSON.stringify(removedPaths, null, 2));

		done(null, data);
	});
}
