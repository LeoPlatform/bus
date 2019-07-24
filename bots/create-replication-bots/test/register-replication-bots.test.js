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
			StackName: 'unit-test-source-stack',
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationSourceAccountId: '123456789',
			QueueReplicationDestinationLeoBotRoleArn: '123456789',
			QueueReplicationDestinationLeoBusStackName: 'unit-test-dest-stack',
			QueueReplicationSourceLeoBusStackName: 'unit-test-source-stack',
			QueueReplicationQueueMapping: '["fooQueue", "barQueue"]'
		};

		await registerReplicationBots(event);

		const fooCallArgs = createBotFunc.getCall(0).args;
		const barCallArgs = createBotFunc.getCall(1).args;

		expect(fooCallArgs).to.be.an('array').that.includes('fooQueue-replication');
		expect(fooCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(fooCallArgs[1].settings.destinationAccount).to.equal('123456789');
		expect(fooCallArgs[1].settings.destinationBusStack).to.equal('unit-test-dest-stack');
		expect(fooCallArgs[1].settings.destinationQueue).to.equal('fooQueue');
		expect(fooCallArgs[1].settings.source).to.equal('fooQueue');
		expect(fooCallArgs[1].triggers).to.be.an('array').that.includes('queue:fooQueue');

		expect(barCallArgs).to.be.an('array').that.includes('barQueue-replication');
		expect(barCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(barCallArgs[1].settings.destinationAccount).to.equal('123456789');
		expect(barCallArgs[1].settings.destinationBusStack).to.equal('unit-test-dest-stack');
		expect(barCallArgs[1].settings.destinationQueue).to.equal('barQueue');
		expect(barCallArgs[1].settings.source).to.equal('barQueue');
		expect(barCallArgs[1].triggers).to.be.an('array').that.includes('queue:barQueue');
	});
  
	it('works with objects', async () => {

		createBotFunc.resolves({ success: "true" });

		const event = { 
			AccountId: '123456789', 
			StackName: 'unit-test-source-stack',
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationSourceAccountId: '123456789',
			QueueReplicationDestinationLeoBotRoleArn: '123456789',
			QueueReplicationDestinationLeoBusStackName: 'unit-test-dest-stack',
			QueueReplicationSourceLeoBusStackName: 'unit-test-source-stack',
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
		expect(fooCallArgs[1].settings.destinationAccount).to.equal('123456789');
		expect(fooCallArgs[1].settings.destinationBusStack).to.equal('unit-test-dest-stack');
		expect(fooCallArgs[1].settings.destinationQueue).to.equal('fooDestination');
		expect(fooCallArgs[1].settings.source).to.equal('fooSource');
		expect(fooCallArgs[1].triggers).to.be.an('array').that.includes('queue:fooSource');

		expect(barCallArgs).to.be.an('array').that.includes('barSource-replication');
		expect(barCallArgs[1].lambdaName).to.equal('fooLambdaName');
		expect(barCallArgs[1].settings.destinationAccount).to.equal('123456789');
		expect(barCallArgs[1].settings.destinationBusStack).to.equal('unit-test-dest-stack');
		expect(barCallArgs[1].settings.destinationQueue).to.equal('barDestination');
		expect(barCallArgs[1].settings.source).to.equal('barSource');
		expect(barCallArgs[1].triggers).to.be.an('array').that.includes('queue:barSource');
	});
  
	it('does not register bots in destination account', async () => {
		const event = { 
			AccountId: '123456789', 
			StackName: 'unit-test-dest-stack',
			ReplicatorLambdaName: 'fooLambdaName', 
			QueueReplicationSourceAccountId: '987654321',
			QueueReplicationDestinationLeoBotRoleArn: '123456789',
			QueueReplicationDestinationLeoBusStackName: 'unit-test-dest-stack',
			QueueReplicationSourceLeoBusStackName: 'unit-test-source-stack',
			QueueReplicationQueueMapping: `[
				{ "source": "fooSource", "destination": "fooDestination"}, 
				{ "source": "barSource", "destination": "barDestination"}
			]`
		};

		await registerReplicationBots(event);

		expect(createBotFunc.called).to.be.equal(false);
	});
});
