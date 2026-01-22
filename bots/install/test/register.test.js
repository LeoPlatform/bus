'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

describe("install/steps/register", () => {
	let register;
	let createBotStub;
	let dynamodbMergeStub;
	let s3UploadStub;

	beforeEach(function () {
		createBotStub = sinon.stub();
		dynamodbMergeStub = sinon.stub();
		s3UploadStub = sinon.stub();

		const leoSdk = {
			bot: {
				createBot: createBotStub
			},
			configuration: {
				resources: {
					LeoSystem: 'test-system-table',
					LeoS3: 'test-s3-bucket',
					Region: 'us-west-2'
				}
			},
			aws: {
				dynamodb: {
					merge: dynamodbMergeStub
				}
			},
			'@global': true
		};

		const leoRef = {
			ref: sinon.stub().callsFake((id) => ({
				id: id.replace(/^queue:/, '')
			}))
		};

		const isSemver = sinon.stub().returns(true);

		const AWS = {
			config: {
				update: sinon.stub()
			},
			S3: class MockS3 {
				upload(params) {
					return {
						promise: s3UploadStub
					};
				}
			},
			'@global': true
		};

		register = proxyquire('../steps/register', {
			'leo-sdk': leoSdk,
			'leo-sdk/lib/reference': leoRef,
			'aws-sdk': AWS,
			'is-semver': isSemver,
			'ajv': require('ajv'),
			'ajv-formats': require('ajv-formats')
		});
	});

	afterEach(function () {
		sinon.restore();
	});

	describe("bot registration", () => {
		it('should register a bot with createBot', async () => {
			createBotStub.resolves({ success: true });

			const data = {
				id: 'test-bot',
				triggers: ['queue1'],
				lambdaName: 'test-lambda'
			};

			await register('TestBot', data);

			expect(createBotStub.calledOnce).to.be.true;
			const [id, config] = createBotStub.getCall(0).args;
			expect(id).to.equal('test-bot');
			expect(config.lambdaName).to.equal('test-lambda');
		});

		it('should parse JSON string data', async () => {
			createBotStub.resolves({ success: true });

			const data = JSON.stringify({
				id: 'test-bot',
				triggers: ['queue1']
			});

			await register('TestBot', data);

			expect(createBotStub.calledOnce).to.be.true;
		});

		it('should set paused to true by default', async () => {
			createBotStub.resolves({ success: true });

			const data = {
				id: 'test-bot'
			};

			await register('TestBot', data);

			const [, config] = createBotStub.getCall(0).args;
			expect(config.paused).to.be.true;
		});

		it('should respect explicit paused value', async () => {
			createBotStub.resolves({ success: true });

			const data = {
				id: 'test-bot',
				paused: 'false'
			};

			await register('TestBot', data);

			const [, config] = createBotStub.getCall(0).args;
			expect(config.paused).to.be.false;
		});

		it('should extract id from lambda ARN', async () => {
			createBotStub.resolves({ success: true });

			const data = {
				id: 'arn:aws:lambda:us-west-2:123456789:function:my-function'
			};

			await register('TestBot', data);

			const [id] = createBotStub.getCall(0).args;
			expect(id).to.equal('my-function');
		});

		it('should convert string numbers to actual numbers', async () => {
			createBotStub.resolves({ success: true });

			const data = {
				id: 'test-bot',
				timeout: '300',
				memory: '512.5'
			};

			await register('TestBot', data);

			const [, config] = createBotStub.getCall(0).args;
			expect(config.timeout).to.equal(300);
			expect(config.memory).to.equal(512.5);
		});

		it('should convert string booleans to actual booleans', async () => {
			createBotStub.resolves({ success: true });

			const data = {
				id: 'test-bot',
				enabled: 'true',
				debug: 'FALSE'
			};

			await register('TestBot', data);

			const [, config] = createBotStub.getCall(0).args;
			expect(config.enabled).to.be.true;
			expect(config.debug).to.be.false;
		});

		it('should convert "null" string to null', async () => {
			createBotStub.resolves({ success: true });

			const data = {
				id: 'test-bot',
				someField: 'null'
			};

			await register('TestBot', data);

			const [, config] = createBotStub.getCall(0).args;
			expect(config.someField).to.be.null;
		});

		it('should convert "undefined" string to undefined', async () => {
			createBotStub.resolves({ success: true });

			const data = {
				id: 'test-bot',
				someField: 'undefined'
			};

			await register('TestBot', data);

			const [, config] = createBotStub.getCall(0).args;
			expect(config.someField).to.be.undefined;
		});

		it('should handle nested objects', async () => {
			createBotStub.resolves({ success: true });

			const data = {
				id: 'test-bot',
				settings: {
					timeout: '300',
					enabled: 'true'
				}
			};

			await register('TestBot', data);

			const [, config] = createBotStub.getCall(0).args;
			expect(config.settings.timeout).to.equal(300);
			expect(config.settings.enabled).to.be.true;
		});

		it('should handle arrays', async () => {
			createBotStub.resolves({ success: true });

			const data = {
				id: 'test-bot',
				triggers: ['queue1', 'queue2'],
				numbers: ['1', '2', '3']
			};

			await register('TestBot', data);

			const [, config] = createBotStub.getCall(0).args;
			expect(config.triggers).to.deep.equal(['queue1', 'queue2']);
			expect(config.numbers).to.deep.equal([1, 2, 3]);
		});
	});

	describe("system registration", () => {
		it('should merge data into system table', async () => {
			dynamodbMergeStub.callsFake((table, id, data, callback) => {
				callback(null);
			});

			const data = {
				LeoRegisterType: 'system',
				id: 'system-config',
				setting1: 'value1'
			};

			await register('SystemConfig', data);

			expect(dynamodbMergeStub.calledOnce).to.be.true;
			const [table, id, mergeData] = dynamodbMergeStub.getCall(0).args;
			expect(table).to.equal('test-system-table');
			expect(id).to.equal('system-config');
		});

		it('should handle merge errors', async () => {
			dynamodbMergeStub.callsFake((table, id, data, callback) => {
				callback(new Error('Merge error'));
			});

			const data = {
				LeoRegisterType: 'system',
				id: 'system-config'
			};

			try {
				await register('SystemConfig', data);
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err.message).to.equal('Merge error');
			}
		});
	});

	describe("queue registration", () => {
		it('should upload schema to S3', async () => {
			s3UploadStub.resolves({ Location: 's3://bucket/key' });

			const data = {
				LeoRegisterType: 'queue',
				queue: 'test-queue',
				schemas: {
					'1.0.0': {
						versionSchema: { type: 'object' },
						definitionsSchema: {}
					}
				}
			};

			await register('QueueSchema', data);

			expect(s3UploadStub.calledOnce).to.be.true;
		});

		it('should reject queue without schemas', async () => {
			const data = {
				LeoRegisterType: 'queue',
				queue: 'test-queue'
			};

			try {
				await register('QueueSchema', data);
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err).to.equal('Queue registered without a schema');
			}
		});

		it('should validate schema version is semver', async () => {
			const isSemverStub = sinon.stub().returns(false);
			
			const registerWithInvalidSemver = proxyquire('../steps/register', {
				'leo-sdk': {
					bot: { createBot: createBotStub },
					configuration: {
						resources: {
							LeoSystem: 'test-system-table',
							LeoS3: 'test-s3-bucket',
							Region: 'us-west-2'
						}
					},
					aws: {
						dynamodb: { merge: dynamodbMergeStub }
					}
				},
				'leo-sdk/lib/reference': {
					ref: () => ({ id: 'test-queue' })
				},
				'aws-sdk': {
					config: { update: sinon.stub() },
					S3: class { upload() { return { promise: s3UploadStub }; } }
				},
				'is-semver': isSemverStub,
				'ajv': require('ajv'),
				'ajv-formats': require('ajv-formats')
			});

			const data = {
				LeoRegisterType: 'queue',
				queue: 'test-queue',
				schemas: {
					'invalid-version': {
						versionSchema: { type: 'object' }
					}
				}
			};

			try {
				await registerWithInvalidSemver('QueueSchema', data);
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err).to.include('was not found to be valid semver');
			}
		});
	});

	describe("unknown type", () => {
		it('should resolve immediately for unknown types', async () => {
			const data = {
				LeoRegisterType: 'unknown'
			};

			const result = await register('Unknown', data);
			
			// Should resolve without error
			expect(createBotStub.called).to.be.false;
			expect(dynamodbMergeStub.called).to.be.false;
		});
	});
});
