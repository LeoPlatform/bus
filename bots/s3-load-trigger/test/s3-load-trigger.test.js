'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

describe("s3-load-trigger", () => {
	let s3LoadTrigger;
	let s3ListObjectsStub;
	let dynamodbGetSettingStub;
	let dynamodbSaveSettingStub;
	let loadStub;
	let streamWriteStub;
	let streamEndStub;

	const mockBucket = 'test-bucket';

	beforeEach(function () {
		s3ListObjectsStub = sinon.stub();
		dynamodbGetSettingStub = sinon.stub();
		dynamodbSaveSettingStub = sinon.stub();
		streamWriteStub = sinon.stub();
		streamEndStub = sinon.stub();

		loadStub = sinon.stub().returns({
			write: streamWriteStub,
			end: streamEndStub
		});

		const leoSdk = {
			configuration: {
				resources: {
					LeoKinesisStream: 'kinesis-stream',
					LeoS3: mockBucket,
					LeoFirehoseStream: 'firehose-stream'
				},
				update: sinon.stub()
			},
			aws: {
				s3: {
					listObjectsV2: s3ListObjectsStub
				},
				dynamodb: {
					getSetting: dynamodbGetSettingStub,
					saveSetting: dynamodbSaveSettingStub
				}
			},
			load: loadStub,
			'@global': true
		};

		s3LoadTrigger = proxyquire('../', {
			'leo-sdk': leoSdk
		});
	});

	afterEach(function () {
		sinon.restore();
	});

	describe("handler", () => {
		it('should load files from S3 and write to stream', (done) => {
			dynamodbGetSettingStub.callsFake((id, callback) => {
				callback(null, { value: 'firehose/previous-file' });
			});

			s3ListObjectsStub.callsFake((params, callback) => {
				callback(null, {
					Contents: [
						{ Key: 'firehose/file1.gz' },
						{ Key: 'firehose/file2.gz' }
					]
				});
			});

			streamEndStub.callsFake((callback) => callback(null));
			
			dynamodbSaveSettingStub.callsFake((id, value, callback) => {
				callback(null);
			});

			const event = {};

			s3LoadTrigger.handler(event, {}, (err) => {
				expect(err).to.be.undefined;
				expect(streamWriteStub.calledOnce).to.be.true;
				
				const writeArg = streamWriteStub.getCall(0).args[0];
				expect(writeArg.payload.command).to.equal('load');
				expect(writeArg.payload.files).to.have.length(2);
				expect(writeArg.payload.files[0]).to.deep.equal({
					bucket: mockBucket,
					key: 'firehose/file1.gz'
				});
				done();
			});
		});

		it('should save the last key position after processing', (done) => {
			dynamodbGetSettingStub.callsFake((id, callback) => {
				callback(null, { value: '' });
			});

			s3ListObjectsStub.callsFake((params, callback) => {
				callback(null, {
					Contents: [
						{ Key: 'firehose/file1.gz' },
						{ Key: 'firehose/last-file.gz' }
					]
				});
			});

			streamEndStub.callsFake((callback) => callback(null));
			
			dynamodbSaveSettingStub.callsFake((id, value, callback) => {
				expect(value).to.equal('firehose/last-file.gz');
				callback(null);
			});

			s3LoadTrigger.handler({}, {}, (err) => {
				expect(err).to.be.undefined;
				expect(dynamodbSaveSettingStub.calledOnce).to.be.true;
				done();
			});
		});

		it('should do nothing when no new files', (done) => {
			dynamodbGetSettingStub.callsFake((id, callback) => {
				callback(null, { value: 'firehose/current-position' });
			});

			s3ListObjectsStub.callsFake((params, callback) => {
				callback(null, {
					Contents: []
				});
			});

			s3LoadTrigger.handler({}, {}, (err) => {
				expect(err).to.be.undefined;
				expect(streamWriteStub.called).to.be.false;
				expect(dynamodbSaveSettingStub.called).to.be.false;
				done();
			});
		});

		it('should handle getSetting error', (done) => {
			dynamodbGetSettingStub.callsFake((id, callback) => {
				callback(new Error('DynamoDB error'));
			});

			s3LoadTrigger.handler({}, {}, (err) => {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('DynamoDB error');
				done();
			});
		});

		it('should handle S3 listObjects error', (done) => {
			dynamodbGetSettingStub.callsFake((id, callback) => {
				callback(null, { value: '' });
			});

			s3ListObjectsStub.callsFake((params, callback) => {
				callback(new Error('S3 error'));
			});

			s3LoadTrigger.handler({}, {}, (err) => {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('S3 error');
				done();
			});
		});

		it('should handle stream end error', (done) => {
			dynamodbGetSettingStub.callsFake((id, callback) => {
				callback(null, { value: '' });
			});

			s3ListObjectsStub.callsFake((params, callback) => {
				callback(null, {
					Contents: [{ Key: 'firehose/file1.gz' }]
				});
			});

			streamEndStub.callsFake((callback) => callback(new Error('Stream error')));

			s3LoadTrigger.handler({}, {}, (err) => {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('Stream error');
				done();
			});
		});

		it('should use empty string as position when setting not found', (done) => {
			dynamodbGetSettingStub.callsFake((id, callback) => {
				callback(null, null);
			});

			s3ListObjectsStub.callsFake((params, callback) => {
				expect(params.StartAfter).to.equal('');
				callback(null, { Contents: [] });
			});

			s3LoadTrigger.handler({}, {}, (err) => {
				expect(err).to.be.undefined;
				done();
			});
		});

		it('should use correct S3 list parameters', (done) => {
			dynamodbGetSettingStub.callsFake((id, callback) => {
				callback(null, { value: 'firehose/start' });
			});

			s3ListObjectsStub.callsFake((params, callback) => {
				expect(params.Bucket).to.equal(mockBucket);
				expect(params.StartAfter).to.equal('firehose/start');
				expect(params.MaxKeys).to.equal(100);
				expect(params.Prefix).to.equal('firehose/');
				callback(null, { Contents: [] });
			});

			s3LoadTrigger.handler({}, {}, () => {
				done();
			});
		});

		it('should create loader with correct parameters', (done) => {
			dynamodbGetSettingStub.callsFake((id, callback) => {
				callback(null, { value: '' });
			});

			s3ListObjectsStub.callsFake((params, callback) => {
				callback(null, {
					Contents: [{ Key: 'firehose/file1.gz' }]
				});
			});

			streamEndStub.callsFake((callback) => callback(null));
			dynamodbSaveSettingStub.callsFake((id, value, callback) => callback(null));

			s3LoadTrigger.handler({}, {}, () => {
				expect(loadStub.calledWith(
					'Leo_core_s3_load_trigger',
					'commands.s3_bus_load',
					{ debug: true }
				)).to.be.true;
				done();
			});
		});
	});
});
