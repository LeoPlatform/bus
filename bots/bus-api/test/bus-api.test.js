'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

describe("bus-api", () => {
	let busApi;
	let botStartStub;
	let botEndStub;
	let botCheckpointStub;
	let readStub;
	let loadStub;
	let pipeStub;
	let writeStreamStub;
	let throughStub;
	
	const mockContext = {
		awsRequestId: 'test-request-id'
	};

	beforeEach(function () {
		botStartStub = sinon.stub();
		botEndStub = sinon.stub();
		botCheckpointStub = sinon.stub();
		readStub = sinon.stub();
		loadStub = sinon.stub();
		pipeStub = sinon.stub();
		writeStreamStub = sinon.stub();
		throughStub = sinon.stub();

		const leoSdk = {
			configuration: {
				resources: {
					LeoKinesisStream: 'kinesis-stream',
					LeoS3: 's3-bucket',
					LeoFirehoseStream: 'firehose-stream'
				},
				update: sinon.stub(),
				registry: {}
			},
			bot: {
				start: botStartStub,
				end: botEndStub,
				checkpoint: botCheckpointStub
			},
			read: readStub,
			load: loadStub,
			streams: {
				pipe: pipeStub,
				write: (fn) => throughStub
			},
			'@global': true
		};

		busApi = proxyquire('../', {
			'leo-sdk': leoSdk,
			'async': require('async')
		});
	});

	afterEach(function () {
		sinon.restore();
	});

	describe("handler", () => {
		it('should reject unsupported action types', (done) => {
			const event = { type: 'unsupported' };
			
			busApi.handler(event, mockContext, (err) => {
				expect(err).to.equal("Unsupported action 'unsupported'.");
				done();
			});
		});

		it('should parse body if present', (done) => {
			const event = { 
				body: { type: 'unsupported' }
			};
			
			busApi.handler(event, mockContext, (err) => {
				expect(err).to.equal("Unsupported action 'unsupported'.");
				done();
			});
		});
	});

	describe("start handler", () => {
		it('should call bot.start with correct parameters', (done) => {
			botStartStub.callsFake((event, options, callback) => {
				callback(null);
			});

			const event = {
				type: 'start',
				id: 'test-bot',
				options: { lock: 'test-lock' }
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('success');
				expect(result.id).to.equal('test-bot');
				expect(result.token).to.have.property('requestId');
				expect(result.token).to.have.property('ts');
				expect(result.duration).to.be.a('number');
				done();
			});
		});

		it('should return error status on bot.start failure', (done) => {
			botStartStub.callsFake((event, options, callback) => {
				callback(new Error('Start failed'));
			});

			const event = {
				type: 'start',
				id: 'test-bot'
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('error');
				expect(result.error).to.be.instanceof(Error);
				done();
			});
		});

		it('should handle missing options', (done) => {
			botStartStub.callsFake((event, options, callback) => {
				callback(null);
			});

			const event = {
				type: 'start',
				id: 'test-bot'
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('success');
				done();
			});
		});
	});

	describe("end handler", () => {
		it('should call bot.end with correct parameters', (done) => {
			botEndStub.callsFake((status, options, callback) => {
				callback(null);
			});

			const event = {
				type: 'end',
				id: 'test-bot',
				status: 'success',
				token: {
					requestId: 'req-123',
					ts: Date.now()
				}
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('success');
				expect(result.id).to.equal('test-bot');
				done();
			});
		});

		it('should handle checkpoint on end if provided', (done) => {
			botCheckpointStub.callsFake((id, queue, params, callback) => {
				callback(null);
			});
			botEndStub.callsFake((status, options, callback) => {
				callback(null);
			});

			const event = {
				type: 'end',
				id: 'test-bot',
				status: 'success',
				checkpoint: {
					eid: 'z/2023/01/01/00/00/12345',
					queue: 'test-queue'
				},
				token: {}
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('success');
				done();
			});
		});

		it('should return error status on bot.end failure', (done) => {
			botEndStub.callsFake((status, options, callback) => {
				callback(new Error('End failed'));
			});

			const event = {
				type: 'end',
				id: 'test-bot',
				status: 'success',
				token: {}
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('error');
				done();
			});
		});

		it('should handle missing token gracefully', (done) => {
			botEndStub.callsFake((status, options, callback) => {
				callback(null);
			});

			const event = {
				type: 'end',
				id: 'test-bot',
				status: 'success'
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('success');
				done();
			});
		});
	});

	describe("read handler", () => {
		it('should return error for missing id', (done) => {
			const event = {
				type: 'read',
				queue: 'test-queue'
			};

			busApi.handler(event, mockContext, (err) => {
				expect(err).to.equal("Invalid parameters. 'id' and 'queue' are required.");
				done();
			});
		});

		it('should return error for missing queue', (done) => {
			const event = {
				type: 'read',
				id: 'test-bot'
			};

			busApi.handler(event, mockContext, (err) => {
				expect(err).to.equal("Invalid parameters. 'id' and 'queue' are required.");
				done();
			});
		});

		it('should read events from queue successfully', (done) => {
			const mockEvents = [{ payload: 'event1' }, { payload: 'event2' }];
			
			pipeStub.callsFake((...args) => {
				// Simulate writing events through the through stream
				const callback = args[args.length - 1];
				callback(null);
			});

			readStub.returns({});
			
			const event = {
				type: 'read',
				id: 'test-bot',
				queue: 'test-queue',
				options: {}
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('success');
				expect(result.id).to.equal('test-bot');
				expect(result.queue).to.equal('test-queue');
				expect(result.count).to.be.a('number');
				done();
			});
		});

		it('should handle read errors', (done) => {
			pipeStub.callsFake((...args) => {
				const callback = args[args.length - 1];
				callback(new Error('Read error'));
			});

			readStub.returns({});
			
			const event = {
				type: 'read',
				id: 'test-bot',
				queue: 'test-queue'
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('error');
				done();
			});
		});
	});

	describe("write handler", () => {
		it('should return error for missing id', (done) => {
			const event = {
				type: 'write',
				queue: 'test-queue',
				events: []
			};

			busApi.handler(event, mockContext, (err) => {
				expect(err).to.equal("Invalid parameters. 'id' and 'queue' are required.");
				done();
			});
		});

		it('should return error for missing queue', (done) => {
			const event = {
				type: 'write',
				id: 'test-bot',
				events: []
			};

			busApi.handler(event, mockContext, (err) => {
				expect(err).to.equal("Invalid parameters. 'id' and 'queue' are required.");
				done();
			});
		});

		it('should write events to queue successfully', (done) => {
			const mockStream = {
				write: sinon.stub().returns(true),
				end: sinon.stub().callsFake((cb) => cb(null)),
				once: sinon.stub()
			};
			loadStub.returns(mockStream);

			const event = {
				type: 'write',
				id: 'test-bot',
				queue: 'test-queue',
				events: [{ payload: 'test1' }, { payload: 'test2' }]
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('success');
				expect(result.count).to.equal(2);
				done();
			});
		});

		it('should handle single event (non-array)', (done) => {
			const mockStream = {
				write: sinon.stub().returns(true),
				end: sinon.stub().callsFake((cb) => cb(null)),
				once: sinon.stub()
			};
			loadStub.returns(mockStream);

			const event = {
				type: 'write',
				id: 'test-bot',
				queue: 'test-queue',
				events: { payload: 'single-event' }
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('success');
				expect(result.count).to.equal(1);
				done();
			});
		});

		it('should handle backpressure (write returns false)', (done) => {
			const mockStream = {
				write: sinon.stub().returns(false),
				end: sinon.stub().callsFake((cb) => cb(null)),
				once: sinon.stub().callsFake((event, cb) => {
					if (event === 'drain') {
						setTimeout(cb, 10);
					}
				})
			};
			loadStub.returns(mockStream);

			const event = {
				type: 'write',
				id: 'test-bot',
				queue: 'test-queue',
				events: [{ payload: 'test' }]
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('success');
				done();
			});
		});

		it('should handle write errors', (done) => {
			const mockStream = {
				write: sinon.stub().returns(true),
				end: sinon.stub().callsFake((cb) => cb(new Error('Write error'))),
				once: sinon.stub()
			};
			loadStub.returns(mockStream);

			const event = {
				type: 'write',
				id: 'test-bot',
				queue: 'test-queue',
				events: [{ payload: 'test' }]
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('error');
				done();
			});
		});

		it('should handle empty events array', (done) => {
			const mockStream = {
				write: sinon.stub().returns(true),
				end: sinon.stub().callsFake((cb) => cb(null)),
				once: sinon.stub()
			};
			loadStub.returns(mockStream);

			const event = {
				type: 'write',
				id: 'test-bot',
				queue: 'test-queue',
				events: []
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('success');
				expect(result.count).to.equal(0);
				done();
			});
		});
	});

	describe("checkpoint handler", () => {
		it('should checkpoint successfully', (done) => {
			botCheckpointStub.callsFake((id, queue, params, callback) => {
				callback(null);
			});

			const event = {
				type: 'checkpoint',
				id: 'test-bot',
				queue: 'test-queue',
				eid: 'z/2023/01/01/00/00/12345',
				units: 10
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('success');
				expect(result.eid).to.equal('z/2023/01/01/00/00/12345');
				done();
			});
		});

		it('should use event.eid if available', (done) => {
			botCheckpointStub.callsFake((id, queue, params, callback) => {
				expect(params.eid).to.equal('event-eid');
				callback(null);
			});

			const event = {
				type: 'checkpoint',
				id: 'test-bot',
				queue: 'test-queue',
				eid: 'original-eid',
				event: { eid: 'event-eid' }
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				done();
			});
		});

		it('should default units to 1 if not provided', (done) => {
			botCheckpointStub.callsFake((id, queue, params, callback) => {
				expect(params.units).to.equal(1);
				callback(null);
			});

			const event = {
				type: 'checkpoint',
				id: 'test-bot',
				queue: 'test-queue',
				eid: 'test-eid'
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				done();
			});
		});

		it('should use records as units if provided', (done) => {
			botCheckpointStub.callsFake((id, queue, params, callback) => {
				expect(params.units).to.equal(25);
				callback(null);
			});

			const event = {
				type: 'checkpoint',
				id: 'test-bot',
				queue: 'test-queue',
				eid: 'test-eid',
				records: 25
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				done();
			});
		});

		it('should handle checkpoint errors', (done) => {
			botCheckpointStub.callsFake((id, queue, params, callback) => {
				callback(new Error('Checkpoint failed'));
			});

			const event = {
				type: 'checkpoint',
				id: 'test-bot',
				queue: 'test-queue',
				eid: 'test-eid'
			};

			busApi.handler(event, mockContext, (err, result) => {
				expect(err).to.be.null;
				expect(result.status).to.equal('error');
				expect(result.eid).to.be.undefined;
				done();
			});
		});
	});
});
