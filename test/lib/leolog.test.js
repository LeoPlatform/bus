'use strict';

const sinon = require('sinon');
const { expect } = require('chai');
const leolog = require('../../lib/leolog');

describe("leolog", () => {
	let consoleLogStub;

	beforeEach(function () {
		consoleLogStub = sinon.stub(console, 'log');
		// Reset cache entries and globalOptions before each test
		leolog.globalOptions = undefined;
	});

	afterEach(function () {
		consoleLogStub.restore();
		// Clean up by finalizing without additional logs
		leolog.finalize(false, true);
	});

	describe("add", () => {
		it('should add a new entry to cache', () => {
			const identifier = 'test-identifier';
			const start = 1000;
			const end = 2000;
			const units = 10;
			const duration = 1000;
			const resource_consumption = 50;
			const isError = false;
			const options = {};

			leolog.add(identifier, start, end, units, duration, resource_consumption, isError, options);
			leolog.finalize(false, true);

			expect(consoleLogStub.calledOnce).to.be.true;
			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.include('[LEOLOG]:v1:');
			expect(logArg).to.include(identifier);
		});

		it('should aggregate multiple adds for same identifier', () => {
			const identifier = 'test-identifier';
			
			leolog.add(identifier, 1000, 2000, 10, 500, 50, false, {});
			leolog.add(identifier, 1500, 2500, 5, 300, 25, false, {});
			leolog.finalize(false, true);

			expect(consoleLogStub.calledOnce).to.be.true;
			const logArg = consoleLogStub.getCall(0).args[0];
			// Should have 2 runs
			expect(logArg).to.include(':2:');
		});

		it('should track errors correctly', () => {
			const identifier = 'error-test';
			
			leolog.add(identifier, 1000, 2000, 10, 500, 50, true, {});
			leolog.add(identifier, 1500, 2500, 5, 300, 25, false, {});
			leolog.finalize(false, true);

			const logArg = consoleLogStub.getCall(0).args[0];
			// Should have 1 error
			expect(logArg).to.match(/:1:[^:]+$/); // ends with :1:identifier (error count)
		});

		it('should use v2 logger when options have keys', () => {
			const identifier = 'v2-test';
			const options = { key: 'some-key', extra: 'value' };
			
			leolog.add(identifier, 1000, 2000, 10, 500, 50, false, options);
			leolog.finalize(false, true);

			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.include('[LEOLOG]:v2:');
		});

		it('should handle __completions option', () => {
			const identifier = 'completions-test';
			const options = { __completions: 5 };
			
			leolog.add(identifier, 1000, 2000, 10, 500, 50, false, options);
			leolog.finalize(false, true);

			// Should log without error
			expect(consoleLogStub.called).to.be.true;
		});

		it('should use globalOptions if set', () => {
			leolog.globalOptions = { key: 'global-key' };
			const identifier = 'global-test';
			
			leolog.add(identifier, 1000, 2000, 10, 500, 50, false, {});
			leolog.finalize(false, true);

			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.include('[LEOLOG]:v2:');
		});

		it('should track max and min duration', () => {
			const identifier = 'duration-test';
			
			leolog.add(identifier, 1000, 2000, 10, 100, 50, false, {});
			leolog.add(identifier, 1500, 2500, 5, 500, 25, false, {});
			leolog.add(identifier, 2000, 3000, 5, 200, 25, false, {});
			leolog.finalize(false, true);

			const logArg = consoleLogStub.getCall(0).args[0];
			// Check for min (100) and max (500) in the output
			expect(logArg).to.include(':100:500:');
		});

		it('should strip first newline from identifier', () => {
			const identifier = 'test\nwith';
			
			leolog.add(identifier, 1000, 2000, 10, 500, 50, false, {});
			leolog.finalize(false, true);

			const logArg = consoleLogStub.getCall(0).args[0];
			// The code replaces only the first newline
			expect(logArg).to.include('testwith');
		});
	});

	describe("finalize", () => {
		it('should log ERROR when addEnd is true and isSuccess is false', () => {
			leolog.finalize(true, false);

			expect(consoleLogStub.calledWith('[LEOLOG]:ERROR')).to.be.true;
		});

		it('should not log ERROR when isSuccess is true', () => {
			leolog.finalize(true, true);

			expect(consoleLogStub.calledWith('[LEOLOG]:ERROR')).to.be.false;
		});

		it('should clear cache entries after finalize', () => {
			leolog.add('test', 1000, 2000, 10, 500, 50, false, {});
			leolog.finalize(false, true);
			consoleLogStub.resetHistory();
			
			// Finalize again should not log anything
			leolog.finalize(false, true);
			expect(consoleLogStub.called).to.be.false;
		});
	});

	describe("finalizeV2", () => {
		it('should use extra options for all entries', () => {
			leolog.add('test1', 1000, 2000, 10, 500, 50, false, {});
			leolog.add('test2', 1500, 2500, 5, 300, 25, false, {});
			
			leolog.finalizeV2({ customKey: 'customValue' }, false, true);

			// Both logs should include customValue
			expect(consoleLogStub.callCount).to.equal(2);
			expect(consoleLogStub.getCall(0).args[0]).to.include('customValue');
			expect(consoleLogStub.getCall(1).args[0]).to.include('customValue');
		});

		it('should log ERROR when addEnd is true and isSuccess is false', () => {
			leolog.finalizeV2({}, true, false);

			expect(consoleLogStub.calledWith('[LEOLOG]:ERROR')).to.be.true;
		});
	});

	describe("systemRead", () => {
		it('should log a system read event', () => {
			leolog.systemRead('bot-id', 'queue.name', 100, {});

			expect(consoleLogStub.calledOnce).to.be.true;
			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.include('[LEOLOG]:v2:');
			expect(logArg).to.include('leo:getEvents:queue.name');
		});

		it('should prepend "system." to event name if not present', () => {
			leolog.systemRead('bot-id', 'my-event', 50, {});

			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.include('system.my-event');
		});

		it('should not modify event name with dots', () => {
			leolog.systemRead('bot-id', 'custom.event.name', 50, {});

			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.include('custom.event.name');
			expect(logArg).to.not.include('system.custom.event.name');
		});

		it('should use provided timestamps', () => {
			const opts = {
				event_source_timestamp: 1000,
				execution_end_timestamp: 2000,
				execution_start_timestamp: 1500,
				duration: 500
			};
			leolog.systemRead('bot-id', 'queue.name', 100, opts);

			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.include('[LEOLOG]:v2:');
		});

		it('should use provided runs and errors', () => {
			const opts = {
				runs: 5,
				errors: 2,
				consumption: 100
			};
			leolog.systemRead('bot-id', 'queue.name', 100, opts);

			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.include('[LEOLOG]:v2:');
		});

		it('should handle function as opts (legacy support)', () => {
			// When opts is a function, it should be treated as empty opts
			leolog.systemRead('bot-id', 'queue.name', 100, function() {});

			expect(consoleLogStub.calledOnce).to.be.true;
		});
	});

	describe("systemWrite", () => {
		it('should log a system write event', () => {
			leolog.systemWrite('bot-id', 'queue.name', 100, {});

			expect(consoleLogStub.calledOnce).to.be.true;
			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.include('[LEOLOG]:v2:');
			expect(logArg).to.include('leo:kinesisWriteEvents:queue.name');
		});

		it('should prepend "system." to event name if not present', () => {
			leolog.systemWrite('bot-id', 'my-event', 50, {});

			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.include('system.my-event');
		});

		it('should not modify event name with dots', () => {
			leolog.systemWrite('bot-id', 'custom.event.name', 50, {});

			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.include('custom.event.name');
			expect(logArg).to.not.include('system.custom.event.name');
		});

		it('should use provided timestamps and options', () => {
			const opts = {
				event_source_timestamp: 1000,
				execution_end_timestamp: 2000,
				execution_start_timestamp: 1500,
				duration: 500,
				runs: 3,
				errors: 1,
				consumption: 75,
				extra: { custom: 'data' }
			};
			leolog.systemWrite('bot-id', 'queue.name', 100, opts);

			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.include('[LEOLOG]:v2:');
		});

		it('should handle function as opts (legacy support)', () => {
			leolog.systemWrite('bot-id', 'queue.name', 100, function() {});

			expect(consoleLogStub.calledOnce).to.be.true;
		});
	});

	describe("loggers", () => {
		it('v1 logger should format correctly', () => {
			const entry = {
				runs: 5,
				start: 1000,
				end: 2000,
				units: 100,
				duration: 1000,
				min_duration: 100,
				max_duration: 500,
				consumption: 50,
				errors: 2,
				id: 'test-bot'
			};
			
			leolog.loggers.v1(entry);

			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.equal('[LEOLOG]:v1:5:1000:2000:100:1000:100:500:50:2:test-bot');
		});

		it('v2 logger should format correctly with JSON', () => {
			const entry = {
				runs: 5,
				start: 1000,
				end: 2000,
				units: 100,
				duration: 1000,
				min_duration: 100,
				max_duration: 500,
				consumption: 50,
				errors: 2,
				id: 'test-bot',
				completions: 3,
				options: { key: 'value' }
			};
			
			leolog.loggers.v2(entry);

			const logArg = consoleLogStub.getCall(0).args[0];
			expect(logArg).to.include('[LEOLOG]:v2:');
			expect(logArg).to.include('"p":');
			expect(logArg).to.include('"e":');
		});
	});
});
