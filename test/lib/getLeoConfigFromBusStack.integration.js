'use strict';

const getLeoConfigFromBusStack = require('../../lib/getLeoConfigFromBusStack');

describe("getLeoConfigFromBusStack", () => {
	it('responds correctly', async () => {
		const config = await getLeoConfigFromBusStack('dev-bus');
		console.log(config);
	});
});
