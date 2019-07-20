'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const event = require('./event.json');

describe("Create Replication Bots", () => {
	let createReplicationBots;
	let registerReplicationBotsFunc;
	let sendCustomerResourceResponseFunc;

	before(function () {
		registerReplicationBotsFunc = sinon.stub();
		sendCustomerResourceResponseFunc = sinon.stub();

		createReplicationBots = proxyquire('../', {
			'./register-replication-bots': registerReplicationBotsFunc,
			'../../lib/sendCustomResourceResponse': sendCustomerResourceResponseFunc
		});
	});

	afterEach(function () {
		registerReplicationBotsFunc.resetHistory();
		sendCustomerResourceResponseFunc.resetHistory();
	});
  
	it('Succeeds upon registration', (done) => {
		registerReplicationBotsFunc.resolves({});
		sendCustomerResourceResponseFunc.resolves({});
		
		createReplicationBots.handler(event, null, () => {
			const registrationStatus = sendCustomerResourceResponseFunc.getCall(0).args[1];
			expect(registrationStatus).to.be.equal('SUCCESS');			
			done();
		});
	});
  
	it('Fails upon registration rejects', (done) => {
		registerReplicationBotsFunc.rejects(new Error("test reject"));
		sendCustomerResourceResponseFunc.resolves({});

		createReplicationBots.handler(event, null, () => {
			const registrationStatus = sendCustomerResourceResponseFunc.getCall(0).args[1];
			expect(registrationStatus).to.be.equal('FAILED');			
			done();
		});
	});
  
	it('Fails upon registration throws', (done) => {
		registerReplicationBotsFunc.throws(() => new Error("test throw"));
		sendCustomerResourceResponseFunc.resolves({});

		createReplicationBots.handler(event, null, () => {
			const registrationStatus = sendCustomerResourceResponseFunc.getCall(0).args[1];
			expect(registrationStatus).to.be.equal('FAILED');			
			done();
		});
	});
});
