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
  
	it('works with strings', async () => {
		createBotFunc.resolves({ success: "true" });

		const event = { 
			AccountId: '123456789', 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationSourceAccount: '123456789',
			QueueReplicationQueueMapping: '["fooQueue", "barQueue"]'
		};

		await registerReplicationBots(event);

		const fooCallArgs = createBotFunc.getCall(0).args;
		const barCallArgs = createBotFunc.getCall(1).args;

		expect(fooCallArgs).to.be.an('array').that.includes('fooQueue-replication');
		expect(fooCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(fooCallArgs[1].triggers).to.be.an('array').that.includes('fooQueue');

		expect(barCallArgs).to.be.an('array').that.includes('barQueue-replication');
		expect(barCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(barCallArgs[1].triggers).to.be.an('array').that.includes('barQueue');
	});
  
	it('works with objects', async () => {

		createBotFunc.resolves({ success: "true" });

		const event = { 
			AccountId: '123456789', 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationSourceAccount: '123456789',
			QueueReplicationQueueMapping: `[
				{ "source": "fooSource", "destination": "fooDestination"}, 
				{ "source": "barSource", "destination": "barDestination"}
			]`
		};

		await registerReplicationBots(event);

		const fooCallArgs = createBotFunc.getCall(0).args;
		const barCallArgs = createBotFunc.getCall(1).args;

		expect(fooCallArgs).to.be.an('array').that.includes('fooSource-replication');
		expect(fooCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(fooCallArgs[1].triggers).to.be.an('array').that.includes('fooSource');

		expect(barCallArgs).to.be.an('array').that.includes('barSource-replication');
		expect(barCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(barCallArgs[1].triggers).to.be.an('array').that.includes('barSource');
	});
  
	it('does not register bots in non-source account', async () => {
		const event = { 
			AccountId: '123456789', 
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationSourceAccount: '987654321',
			QueueReplicationQueueMapping: `[
				{ "source": "fooSource", "destination": "fooDestination"}, 
				{ "source": "barSource", "destination": "barDestination"}
			]`
		};

		await registerReplicationBots(event);

		expect(createBotFunc.called).to.be.equal(false);
	});
});
