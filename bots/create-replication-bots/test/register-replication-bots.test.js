'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

describe("add-replication-queues", () => {
	let registerReplicationBots;
	let createBotFunc;

	before(function () {
		createBotFunc = sinon.stub();

		let leoSdk = {
			bot: {
				createBot: createBotFunc
			}
		};

		registerReplicationBots = proxyquire('../register-replication-bots', {
			'leo-sdk': leoSdk
		});
	});

	afterEach(function () {
		createBotFunc.resetHistory();
	});
  
	it('works', async () => {
		createBotFunc.resolves({ success: "true" });

		const event = { 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationDestinationLeoBotRoleARNs: ['arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY', 'arn:aws:iam::11111:role/test-bus-LeoBotRole-XXXXX'],
			QueueReplicationMapping: '[{"fooQueue": { "account": "11111", "stack": "test-bus", "destination":  "DEST_QUEUE"}}, {"barQueue": { "account": "22222", "stack": "dev-bus", "destination":  "DEST_QUEUEB"}}]'
		};

		await registerReplicationBots(event);

		const fooCallArgs = createBotFunc.getCall(0).args;
		const barCallArgs = createBotFunc.getCall(1).args;

		expect(fooCallArgs).to.be.an('array').that.includes('replicate-fooQueue-to-11111-test-bus-DEST_QUEUE');
		expect(fooCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(fooCallArgs[1].settings.destinationLeoBotRoleArn).to.equal('arn:aws:iam::11111:role/test-bus-LeoBotRole-XXXXX');
		expect(fooCallArgs[1].settings.destinationBusStack).to.equal('test-bus');
		expect(fooCallArgs[1].settings.destinationQueue).to.equal('DEST_QUEUE');
		expect(fooCallArgs[1].settings.sourceQueue).to.equal('fooQueue');
		expect(fooCallArgs[1].triggers).to.be.an('array').that.includes('fooQueue');

		expect(barCallArgs).to.be.an('array').that.includes('replicate-barQueue-to-22222-dev-bus-DEST_QUEUEB');
		expect(barCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(barCallArgs[1].settings.destinationLeoBotRoleArn).to.equal('arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY');
		expect(barCallArgs[1].settings.destinationBusStack).to.equal('dev-bus');
		expect(barCallArgs[1].settings.destinationQueue).to.equal('DEST_QUEUEB');
		expect(barCallArgs[1].settings.sourceQueue).to.equal('barQueue');
		expect(barCallArgs[1].triggers).to.be.an('array').that.includes('barQueue');
	});
  
	it('works with destination convetion', async () => {
		createBotFunc.resolves({ success: "true" });

		const event = { 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationDestinationLeoBotRoleARNs: ['arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY', 'arn:aws:iam::11111:role/test-bus-LeoBotRole-XXXXX'],
			QueueReplicationMapping: '[{"fooQueue": { "account": "11111", "stack": "test-bus" }}, {"barQueue": { "account": "22222", "stack": "dev-bus"}}]'
		};

		await registerReplicationBots(event);

		const fooCallArgs = createBotFunc.getCall(0).args;
		const barCallArgs = createBotFunc.getCall(1).args;

		expect(fooCallArgs).to.be.an('array').that.includes('replicate-fooQueue-to-11111-test-bus-fooQueue');
		expect(fooCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(fooCallArgs[1].settings.destinationLeoBotRoleArn).to.equal('arn:aws:iam::11111:role/test-bus-LeoBotRole-XXXXX');
		expect(fooCallArgs[1].settings.destinationBusStack).to.equal('test-bus');
		expect(fooCallArgs[1].settings.destinationQueue).to.equal('fooQueue');
		expect(fooCallArgs[1].settings.sourceQueue).to.equal('fooQueue');
		expect(fooCallArgs[1].triggers).to.be.an('array').that.includes('fooQueue');

		expect(barCallArgs).to.be.an('array').that.includes('replicate-barQueue-to-22222-dev-bus-barQueue');
		expect(barCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(barCallArgs[1].settings.destinationLeoBotRoleArn).to.equal('arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY');
		expect(barCallArgs[1].settings.destinationBusStack).to.equal('dev-bus');
		expect(barCallArgs[1].settings.destinationQueue).to.equal('barQueue');
		expect(barCallArgs[1].settings.sourceQueue).to.equal('barQueue');
		expect(barCallArgs[1].triggers).to.be.an('array').that.includes('barQueue');
	});
  
	it('works with account and stack convetion. Default to first ARNs account and stack', async () => {
		createBotFunc.resolves({ success: "true" });

		const event = { 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationDestinationLeoBotRoleARNs: ['arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY'],
			QueueReplicationMapping: '[{"fooQueue": { "stack": "dev-bus" }}, {"barQueue": { "account": "22222" }}]'
		};

		await registerReplicationBots(event);

		const fooCallArgs = createBotFunc.getCall(0).args;
		const barCallArgs = createBotFunc.getCall(1).args;

		expect(fooCallArgs).to.be.an('array').that.includes('replicate-fooQueue-to-22222-dev-bus-fooQueue');
		expect(fooCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(fooCallArgs[1].settings.destinationLeoBotRoleArn).to.equal('arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY');
		expect(fooCallArgs[1].settings.destinationBusStack).to.equal('dev-bus');
		expect(fooCallArgs[1].settings.destinationQueue).to.equal('fooQueue');
		expect(fooCallArgs[1].settings.sourceQueue).to.equal('fooQueue');
		expect(fooCallArgs[1].triggers).to.be.an('array').that.includes('fooQueue');

		expect(barCallArgs).to.be.an('array').that.includes('replicate-barQueue-to-22222-dev-bus-barQueue');
		expect(barCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(barCallArgs[1].settings.destinationLeoBotRoleArn).to.equal('arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY');
		expect(barCallArgs[1].settings.destinationBusStack).to.equal('dev-bus');
		expect(barCallArgs[1].settings.destinationQueue).to.equal('barQueue');
		expect(barCallArgs[1].settings.sourceQueue).to.equal('barQueue');
		expect(barCallArgs[1].triggers).to.be.an('array').that.includes('barQueue');
	});
  
	it('works with string convetion. Default to first ARNs account and stack', async () => {
		createBotFunc.resolves({ success: "true" });

		const event = { 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationDestinationLeoBotRoleARNs: ['arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY'],
			QueueReplicationMapping: '["fooQueue", "barQueue"]'
		};

		await registerReplicationBots(event);

		const fooCallArgs = createBotFunc.getCall(0).args;
		const barCallArgs = createBotFunc.getCall(1).args;

		expect(fooCallArgs).to.be.an('array').that.includes('replicate-fooQueue-to-22222-dev-bus-fooQueue');
		expect(fooCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(fooCallArgs[1].settings.destinationLeoBotRoleArn).to.equal('arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY');
		expect(fooCallArgs[1].settings.destinationBusStack).to.equal('dev-bus');
		expect(fooCallArgs[1].settings.destinationQueue).to.equal('fooQueue');
		expect(fooCallArgs[1].settings.sourceQueue).to.equal('fooQueue');
		expect(fooCallArgs[1].triggers).to.be.an('array').that.includes('fooQueue');

		expect(barCallArgs).to.be.an('array').that.includes('replicate-barQueue-to-22222-dev-bus-barQueue');
		expect(barCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(barCallArgs[1].settings.destinationLeoBotRoleArn).to.equal('arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY');
		expect(barCallArgs[1].settings.destinationBusStack).to.equal('dev-bus');
		expect(barCallArgs[1].settings.destinationQueue).to.equal('barQueue');
		expect(barCallArgs[1].settings.sourceQueue).to.equal('barQueue');
		expect(barCallArgs[1].triggers).to.be.an('array').that.includes('barQueue');
	});
  
	it('fails with malformed QueueReplicationDestinationLeoBotRoleARNs', (done) => {
	
		const event = { 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationDestinationLeoBotRoleARNs: ['arn:aws:iadfm::22222:role/dev-bus-LeoBotRole-YYYYY', 'arn:aws:iam::11111:role/test-bus-LeosdBotRole-XXXXX'],
			QueueReplicationMapping: '[{"fooQueue": { "account": "11111", "stack": "test-bus", "destination":  "DEST_QUEUE"}}, {"barQueue": { "account": "22222", "stack": "dev-bus", "destination":  "DEST_QUEUEB"}}]'
		};

		registerReplicationBots(event).then(() => {
			done(new Error("Should have failed"));
		}, (err) => {
			expect(err.message).to.be.equal("Malformed QueueReplicationDestinationLeoBotRoleARNs parameter. Should be a comma delimited list of LeoBotRole ARNs.");
			done();
		}).catch((err) => {
			done(err);
		});
	});
  
	it('fails with malformed QueueReplicationMapping', (done) => {
	
		const event = { 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationDestinationLeoBotRoleARNs: ['arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY', 'arn:aws:iam::11111:role/test-bus-LeoBotRole-XXXXX'],
			QueueReplicationMapping: '[{"fooQueue": { "account": "11111", "stack": "test-bus", "destination":  "DEST_QUEUE"}, {"barQueue": { "account": "22222", "stack": "dev-bus", "destination":  "DEST_QUEUEB"}}]'
		};

		registerReplicationBots(event).then(() => {
			done(new Error("Should have failed"));
		}, (err) => {
			expect(err.message).to.be.equal("Malformed QueueReplicationMapping parameter. Must be valid JSON.");
			done();
		}).catch((err) => {
			done(err);
		});
	});
  
	it('fails with QueueReplicationMapping not array', (done) => {
	
		const event = { 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationDestinationLeoBotRoleARNs: ['arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY', 'arn:aws:iam::11111:role/test-bus-LeoBotRole-XXXXX'],
			QueueReplicationMapping: '{"fooQueue": { "account": "11111", "stack": "test-bus", "destination":  "DEST_QUEUE"}}'
		};

		registerReplicationBots(event).then(() => {
			done(new Error("Should have failed"));
		}, (err) => {
			expect(err.message).to.be.equal("Malformed QueueReplicationMapping parameter. Must be JSON Array.");
			done();
		}).catch((err) => {
			done(err);
		});
	});
  
	it('fails with queuemap missing ARNs', (done) => {
	
		const event = { 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationDestinationLeoBotRoleARNs: ['arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY', 'arn:aws:iam::11111:role/test-bus-LeoBotRole-XXXXX'],
			QueueReplicationMapping: '[{"fooQueue": { "account": "11111", "stack": "test-bus", "destination":  "DEST_QUEUE"}}]'
		};

		registerReplicationBots(event).then(() => {
			done(new Error("Should have failed"));
		}, (err) => {
			expect(err.message).to.be.equal("QueueReplication* parameters do not match per account and stack");
			done();
		}).catch((err) => {
			done(err);
		});
	});
  
	it('fails with ARNs missing queuemap', (done) => {
	
		const event = { 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationDestinationLeoBotRoleARNs: ['arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY'],
			QueueReplicationMapping: '[{"fooQueue": { "account": "11111", "stack": "test-bus", "destination":  "DEST_QUEUE"}}, {"barQueue": { "account": "22222", "stack": "dev-bus", "destination":  "DEST_QUEUEB"}}]'
		};

		registerReplicationBots(event).then(() => {
			done(new Error("Should have failed"));
		}, (err) => {
			expect(err.message).to.be.equal("QueueReplication* parameters do not match per account and stack");
			done();
		}).catch((err) => {
			done(err);
		});
	});
  
	it('fails creating bot: rejected', (done) => {
		createBotFunc.rejects(new Error("Bot Rejected"));

		const event = { 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationDestinationLeoBotRoleARNs: ['arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY', 'arn:aws:iam::11111:role/test-bus-LeoBotRole-XXXXX'],
			QueueReplicationMapping: '[{"fooQueue": { "account": "11111", "stack": "test-bus", "destination":  "DEST_QUEUE"}}, {"barQueue": { "account": "22222", "stack": "dev-bus", "destination":  "DEST_QUEUEB"}}]'
		};

		registerReplicationBots(event).then(() => {
			done(new Error("Should have failed"));
		}, (err) => {
			expect(err.message).to.be.equal("Bot Rejected");
			done();
		}).catch((err) => {
			done(err);
		});
	});
  
	it('fails creating bot: throws', (done) => {
		createBotFunc.throws(new Error("Bot Failure"));

		const event = { 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationDestinationLeoBotRoleARNs: ['arn:aws:iam::22222:role/dev-bus-LeoBotRole-YYYYY', 'arn:aws:iam::11111:role/test-bus-LeoBotRole-XXXXX'],
			QueueReplicationMapping: '[{"fooQueue": { "account": "11111", "stack": "test-bus", "destination":  "DEST_QUEUE"}}, {"barQueue": { "account": "22222", "stack": "dev-bus", "destination":  "DEST_QUEUEB"}}]'
		};

		registerReplicationBots(event).then(() => {
			done(new Error("Should have failed"));
		}, (err) => {
			expect(err.message).to.be.equal("Error Creating Bot.");
			done();
		}).catch((err) => {
			done(err);
		});
	});
});
