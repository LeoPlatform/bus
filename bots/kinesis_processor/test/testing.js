
let zlib = require("zlib");

const leo = require("leo-sdk");
const ls = leo.streams;
let moment = require("moment");
var currentTimeMilliseconds = moment.utc().valueOf();
const refUtil = require("leo-sdk/lib/reference.js");


let eventsToSkip = {};
let botsToSkip = {};
let event = {
	"Records": [
		{
			"kinesis": {
				"kinesisSchemaVersion": "1.0",
				"partitionKey": "0",
				"sequenceNumber": "49617540848801912135011979009631964890560033795128426498",
				"data": "H4sIAAAAAAAA/4VRzXKDIBB+lz1L+FMTfYkeeuz0ILgmJhYygJlWx3cvkmTSTqctp4X99vthZ/AS6hnUqE8YoIaAPujDqNToyYDWS8KPhTLDnomzfxeQwQk/Ii72aYsXToJrjO+se8OWWNei83Q0fUCyMhHrb48PHJ2oYIJTVlAuY0nznPJSsEruyq1kvCIsHU4qXiHyvCSs22qS560iSjWadAI133VMtQ3bHL01m/0ESwa26zwGD/XLDGhaqFkGPjQupAovaNaEv7iOyfZTf35KHGlgvT73E0JdFfmdPXUc6jgUhXgUSAghhFxev3f+F7yZM+MwZFfH/Ifsgz+DyO1waEJvTZSYY+TG6UN/iYCuGTwmxvUDZvh7ByviJn7/+nLLC3l38XUdWeK6RtIH1Kez7ddcbFmWT1t898A/AgAA",
				"approximateArrivalTimestamp": 1620938673.291
			},
			"eventSource": "aws:kinesis",
			"eventVersion": "1.0",
			"eventID": "shardId-000000000000:49617540848801912135011979009631964890560033795128426498",
			"eventName": "aws:kinesis:record",
			"invokeIdentityArn": "arn:aws:iam::220162591379:role/TestChubBus-LeoKinesisRole-1JSEB10IG41VQ",
			"awsRegion": "us-east-1",
			"eventSourceARN": "arn:aws:kinesis:us-east-1:220162591379:stream/TestChubBus-LeoKinesisStream-x5eCGHLiI34m"
		},
		{
			"kinesis": {
				"kinesisSchemaVersion": "1.0",
				"partitionKey": "0",
				"sequenceNumber": "49617540848801912135011979009816930540961072058858471426",
				"data": "H4sIAAAAAAAAA8VQS26EMAzdzzGyBkESPoXLRBEYFZVg6piRpoi718xopFFRN900iyjxs/0+m1r8bULfq3ZTo9xqnUeGlCFyijFF6oFiyuTnOCAFlSi+LSB9BDKUqIEwyO9zhRVajA7CyAzkerhq13v20tO9Q/ex4DizdH5lJjc6y8tMW3lmRZHpyuSNfauqpjBFmj/OwRRV+8Rqm+smuas7qomK7IlPeMSVOnCvk1WtS7snD3cToOsIZxdQNiEJC1zhLuxHxT1XjUGy8GF55SpNLfJ+ReDgyvfL9ud0OwzLBAz9KQZrzNm8biorDiV+IrHQDn6K8A+e9X75BvumZ/NSAgAA",
				"approximateArrivalTimestamp": 1620938673.75
			},
			"eventSource": "aws:kinesis",
			"eventVersion": "1.0",
			"eventID": "shardId-000000000000:49617540848801912135011979009816930540961072058858471426",
			"eventName": "aws:kinesis:record",
			"invokeIdentityArn": "arn:aws:iam::220162591379:role/TestChubBus-LeoKinesisRole-1JSEB10IG41VQ",
			"awsRegion": "us-east-1",
			"eventSourceARN": "arn:aws:kinesis:us-east-1:220162591379:stream/TestChubBus-LeoKinesisStream-x5eCGHLiI34m"
		}
	]
};



var stream = ls.parse(true);
ls.pipe(stream, ls.through((event, callback) => {
	console.log("doing stuff", event);
	//We can't process it without these
	if (event._cmd) {
		if (event._cmd == "registerSnapshot") {
			snapshots[refUtil.ref(event.event + "/_snapshot").queue().id] = {
				start: "_snapshot/" + moment(event.start).format(eventIdFormat),
				next: moment(event.next).format(eventIdFormat)
			};
		}
		console.log("command");
		return callback();
	} else if (!event.event || ((!event.id || !event.payload) && !event.s3) || eventsToSkip[refUtil.ref(event.event)] || botsToSkip[event.id]) {
		console.log("missing data");
		return callback(null);
	}
	let forceEventId = null;
	let archive = null;
	if (event.archive) {
		console.log("archive");
		event.event = refUtil.ref(event.event + "/_archive").queue().id;
		archive = {
			start: event.start,
			end: event.end
		};
	} else if (event.snapshot) {
		console.log("snapshot");
		event.event = refUtil.ref(event.event + "/_snapshot").queue().id;
		forceEventId = moment(event.snapshot).format(eventIdFormat) + timestamp.valueOf();
	} else {
		console.log("normal");
		event.event = refUtil.ref(event.event).queue().id;
	}

	//If it is missing these, we can just create them.
	if (!event.timestamp) {
		event.timestamp = currentTimeMilliseconds;
	}
	if (!event.event_source_timestamp) {
		event.event_source_timestamp = event.timestamp;
	}
	if (typeof event.event_source_timestamp !== "number") {
		event.event_source_timestamp = moment(event.event_source_timestamp).valueOf();
	}
	//getEventStream(event.event, forceEventId, archive).write(event, callback);
	callback(null, event);
}), ls.devnull(), function (err) {
	console.log("Done", err || "");
});

event.Records.map((record) => {
	if (record.kinesis.data[0] === 'H') {
		console.log("gzip");
		stream.write(zlib.gunzipSync(Buffer.from(record.kinesis.data, 'base64')) + "\n");
	} else if (record.kinesis.data[0] === 'e' && record.kinesis.data[1] === 'J') {
		console.log("inflate");
		stream.write(zlib.inflateSync(Buffer.from(record.kinesis.data, 'base64')));
	} else if (record.kinesis.data[0] === 'e' && record.kinesis.data[1] === 'y') {
		stream.write(Buffer.from(record.kinesis.data, 'base64').toString() + "\n");

		console.log("base64");
	} else {

		console.log("none");
	}
});
stream.end()


let content = [
	"H4sIAAAAAAAAA61SPW/bMBDd+zM4ixVJkeLH1iFDpg4Zi0KgJMpWLVGCSKWtDf/3HhWnSWAjyBBOvK93797dCblH5yMyaAqVG/sY3VK17pFWrY0WZShEu0DYr8OQIedbZAg4C2ROqF6bg0ul0YXY7Ne6XgMe3BQKTH+J2g87wubwhwHKwf2FPIjnt9pcOQ+9d6EPVe93AJ0fc0YYzYnIaQHfXLCclozoQlMuNWWYbI9iykTXdKXAmhGOuaolVm0NptadsFI3UtVfd0d0ztDUdcHFgMyP0wclIC/zL66ZlhaKaYZ2x35+6I8OjEIxyN7+nFH13GQrSWnfn83zz/frXuND90TzdMXurUgp40L0RRtWqgvp13oVGVp9H5/gm71rDvPU+40XCAOdFzfY2E/+SR27eGN/B3PpZ2DJzoaIqZFCMqkFJ4VgJsTF2TGfxwYnevjbPN8lXR82/0ZvWpcGZvwkxP+LQWFvl/a+vZxBeqIwXJdESa0ZZ1ooKTjjnClCqdClAH9JBGFMcS64kGUhwEy3lK51U+zTUd8sdZOiiv0Iq7PjfLW0mxFY3Tmdzq2gImU60KRP9Q56Sjt/+QfWhJBm9gMAAA==",
	"H4sIAAAAAAAA/4VRzXKDIBB+lz1L+FMTfYkeeuz0ILgmJhYygJlWx3cvkmTSTqctp4X99vthZ/AS6hnUqE8YoIaAPujDqNToyYDWS8KPhTLDnomzfxeQwQk/Ii72aYsXToJrjO+se8OWWNei83Q0fUCyMhHrb48PHJ2oYIJTVlAuY0nznPJSsEruyq1kvCIsHU4qXiHyvCSs22qS560iSjWadAI133VMtQ3bHL01m/0ESwa26zwGD/XLDGhaqFkGPjQupAovaNaEv7iOyfZTf35KHGlgvT73E0JdFfmdPXUc6jgUhXgUSAghhFxev3f+F7yZM+MwZFfH/Ifsgz+DyO1waEJvTZSYY+TG6UN/iYCuGTwmxvUDZvh7ByviJn7/+nLLC3l38XUdWeK6RtIH1Kez7ddcbFmWT1t898A/AgAA"
];
content.forEach(c => {
	console.log(`+++++++++++++${zlib.gunzipSync(Buffer.from(c, 'base64'))}+++++++++++++++`);
});



