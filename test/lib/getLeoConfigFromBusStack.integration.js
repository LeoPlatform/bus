'use strict';

const getLeoConfigFromBusStack = require('../../lib/getLeoConfigFromBusStack');
const logger = require('leo-logger');

describe("getLeoConfigFromBusStack", () => {
	it('responds correctly', async () => {
		const config = await getLeoConfigFromBusStack('dev-bus');
		logger.log(config);
	});
});
