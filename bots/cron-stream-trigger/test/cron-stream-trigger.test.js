'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

describe("cron-stream-trigger", () => {
	let cronStreamTrigger;
	let dynamodbDocClientUpdateStub;
	let dynamodbQueryStub;
	let awsConverterStub;

	const mockCronTable = 'test-cron-table';

	beforeEach(function () {
		dynamodbDocClientUpdateStub = sinon.stub();
		dynamodbQueryStub = sinon.stub();

		awsConverterStub = {
			unmarshall: sinon.stub().callsFake((item) => item)
		};

		const leoSdk = {
			configuration: {
				resources: {
					LeoCron: mockCronTable
				}
			},
			aws: {
				dynamodb: {
					docClient: {
						update: dynamodbDocClientUpdateStub
					},
					query: dynamodbQueryStub
				}
			},
			'@global': true
		};

		const refUtil = {
			refId: sinon.stub().callsFake((id) => id),
			'@global': true
		};

		const aws = {
			DynamoDB: {
				Converter: awsConverterStub
			},
			'@global': true
		};

		const momentMock = function() {
			return {
				now: function() { return 1609459200000; }
			};
		};
		momentMock.now = sinon.stub().returns(1609459200000);

		cronStreamTrigger = proxyquire('../', {
			'leo-sdk': leoSdk,
			'leo-sdk/lib/reference.js': refUtil,
			'aws-sdk': aws,
			'moment': momentMock,
			'async': require('async')
		});
	});

	afterEach(function () {
		sinon.restore();
	});

	describe("handler", () => {
		it('should trigger bots when event data changes', (done) => {
			// Setup cache lookup with proper promise chain
			dynamodbQueryStub.returns(
				Promise.resolve({
					Items: [{
						id: 'test-bot',
						triggers: ['test-queue'],
						archived: false
					}]
				})
			);

			dynamodbDocClientUpdateStub.callsFake((params, callback) => {
				callback(null);
			});

			const event = {
				Records: [{
					dynamodb: {
						NewImage: {
							event: 'test-queue',
							kinesis_number: '12345',
							s3_kinesis_number: null,
							initial_kinesis_number: null,
							s3_new_kinesis_number: null,
							eid: null,
							max_eid: null
						},
						OldImage: {
							event: 'test-queue',
							kinesis_number: '12340',
							s3_kinesis_number: null,
							initial_kinesis_number: null,
							s3_new_kinesis_number: null,
							eid: null,
							max_eid: null
						}
					}
				}]
			};

			cronStreamTrigger.handler(event, {}, (err, result) => {
				expect(err).to.be.null;
				expect(result).to.have.property('data');
				expect(result).to.have.property('time');
				done();
			});
		});

		it('should not trigger if new and old max values are the same', (done) => {
			dynamodbQueryStub.returns(
				Promise.resolve({
					Items: [{
						id: 'test-bot',
						triggers: ['test-queue'],
						archived: false
					}]
				})
			);

			const event = {
				Records: [{
					dynamodb: {
						NewImage: {
							event: 'test-queue',
							kinesis_number: '12345'
						},
						OldImage: {
							event: 'test-queue',
							kinesis_number: '12345'
						}
					}
				}]
			};

			cronStreamTrigger.handler(event, {}, (err, result) => {
				expect(err).to.be.null;
				expect(result.data).to.deep.equal({});
				done();
			});
		});

		it('should handle records without NewImage', (done) => {
			dynamodbQueryStub.returns(
				Promise.resolve({
					Items: []
				})
			);

			const event = {
				Records: [{
					dynamodb: {
						OldImage: {
							event: 'test-queue'
						}
					}
				}]
			};

			cronStreamTrigger.handler(event, {}, (err, result) => {
				expect(err).to.be.null;
				expect(result.data).to.deep.equal({});
				done();
			});
		});

		it('should skip archived bots', (done) => {
			dynamodbQueryStub.returns(
				Promise.resolve({
					Items: [{
						id: 'archived-bot',
						triggers: ['test-queue'],
						archived: true
					}, {
						id: 'active-bot',
						triggers: ['test-queue'],
						archived: false
					}]
				})
			);

			dynamodbDocClientUpdateStub.callsFake((params, callback) => {
				callback(null);
			});

			const event = {
				Records: [{
					dynamodb: {
						NewImage: {
							event: 'test-queue',
							kinesis_number: '12345'
						},
						OldImage: {
							event: 'test-queue',
							kinesis_number: '12340'
						}
					}
				}]
			};

			cronStreamTrigger.handler(event, {}, (err, result) => {
				expect(err).to.be.null;
				done();
			});
		});

		it('should skip bots without triggers', (done) => {
			dynamodbQueryStub.returns(
				Promise.resolve({
					Items: [{
						id: 'no-trigger-bot',
						archived: false
					}]
				})
			);

			const event = {
				Records: [{
					dynamodb: {
						NewImage: {
							event: 'test-queue',
							kinesis_number: '12345'
						},
						OldImage: {
							event: 'test-queue',
							kinesis_number: '12340'
						}
					}
				}]
			};

			cronStreamTrigger.handler(event, {}, (err, result) => {
				expect(err).to.be.null;
				done();
			});
		});

		it('should handle DynamoDB update errors', (done) => {
			dynamodbQueryStub.returns(
				Promise.resolve({
					Items: [{
						id: 'test-bot',
						triggers: ['test-queue'],
						archived: false
					}]
				})
			);

			dynamodbDocClientUpdateStub.callsFake((params, callback) => {
				callback(new Error('DynamoDB error'));
			});

			const event = {
				Records: [{
					dynamodb: {
						NewImage: {
							event: 'test-queue',
							kinesis_number: '12345'
						},
						OldImage: {
							event: 'test-queue',
							kinesis_number: '12340'
						}
					}
				}]
			};

			cronStreamTrigger.handler(event, {}, (err) => {
				expect(err).to.be.instanceof(Error);
				done();
			});
		});

		it('should handle cron table query errors', (done) => {
			dynamodbQueryStub.returns(
				Promise.reject(new Error('Query failed'))
			);

			const event = {
				Records: [{
					dynamodb: {
						NewImage: {
							event: 'test-queue',
							kinesis_number: '12345'
						},
						OldImage: {
							event: 'test-queue',
							kinesis_number: '12340'
						}
					}
				}]
			};

			cronStreamTrigger.handler(event, {}, (err) => {
				expect(err).to.be.instanceof(Error);
				done();
			});
		});
	});
});
