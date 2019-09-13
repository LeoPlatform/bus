'use strict';

const sinon = require('sinon');
const https = require('https');
const { expect } = require('chai');
const sendCustomResourceResponse = require('../../lib/sendCustomResourceResponse');

describe("sendCustomResourceResponse", () => {
	let httpRequestFunc;
	let reqeustOnFunc;
	let reqeustWriteFunc;
	let reqeustEndFunc;

	before(function () {
		reqeustOnFunc = sinon.stub();
		reqeustWriteFunc = sinon.stub();
		reqeustEndFunc = sinon.stub();		

		httpRequestFunc = sinon.stub(https, 'request');
		httpRequestFunc.returns({
			on: reqeustOnFunc,
			write: reqeustWriteFunc,
			end: reqeustEndFunc
		});
	});

	afterEach(function () {
		httpRequestFunc.resetHistory();
		reqeustOnFunc.resetHistory();
		reqeustWriteFunc.resetHistory();
		reqeustEndFunc.resetHistory();
	});
  
	it('responds correctly', (done) => {
		const status = "SUCCESS";
		const reason = "It Works!";
		const event = {
			ResponseURL: 'https://example.com',
			PhysicalResourceId: 'physicalresourceid',
			StackId: 'stackid',
			RequestId: 'requestid',
			LogicalResourceId: 'logicalresourceid'
		};
		
		httpRequestFunc.yields({
			statusCode: 200,
			statusMessage: "Awesome"
		});

		sendCustomResourceResponse(event, status, reason).then(() => {

			expect(reqeustEndFunc.calledOnce).to.be.equal(true);
			expect(reqeustWriteFunc.calledOnce).to.be.equal(true);
			expect(reqeustOnFunc.calledOnce).to.be.equal(true);

			const httpRequestOptions = httpRequestFunc.getCall(0).args[0];
			expect(httpRequestOptions.hostname).to.be.equal('example.com');
			
			const httpBody = reqeustWriteFunc.getCall(0).args[0];
			expect(httpBody).to.have.string(status);
			expect(httpBody).to.have.string(reason);
			expect(httpBody).to.have.string(event.PhysicalResourceId);
			expect(httpBody).to.have.string(event.RequestId);
			expect(httpBody).to.have.string(event.StackId);
			expect(httpBody).to.have.string(event.LogicalResourceId);

			done();
		});		
	});
});
