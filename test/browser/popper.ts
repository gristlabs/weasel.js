import {assert, driver, useServer} from 'mocha-webdriver';
import {server} from '../fixtures/webpack-test-server';

describe('popper', () => {
  useServer(server);

  before(async function() {
    this.timeout(60000);      // Set a longer default timeout.
    await driver.get(`${server.getHost()}/popper`);
  });

  it('should get positioned as requested', async function() {
    // Ensure the popper is intended to be on top.
    // Get the position of popper, and verify that it is indeed on top.
    assert.equal(await driver.find('.test-popper').getText(), 'Popper on top');
    // (For element to be above, the numeric position should have a lower value.)
    assert.closeTo((await driver.find('.test-popper').rect()).bottom,
      (await driver.find('.test-ref').rect()).top, 30);

    // Switch to right and verify.
    await driver.findContent('.test-ref option', /Right/).doClick();
    assert.equal(await driver.find('.test-popper').getText(), 'Popper on right');
    assert.closeTo((await driver.find('.test-popper').rect()).left,
      (await driver.find('.test-ref').rect()).right, 30);

    // Switch to bottom and verify.
    await driver.findContent('.test-ref option', /Bottom/).doClick();
    assert.equal(await driver.find('.test-popper').getText(), 'Popper on bottom');
    assert.closeTo((await driver.find('.test-popper').rect()).top,
      (await driver.find('.test-ref').rect()).bottom, 30);

    // Switch to left and verify.
    await driver.findContent('.test-ref option', /Left/).doClick();
    assert.equal(await driver.find('.test-popper').getText(), 'Popper on left');
    assert.closeTo((await driver.find('.test-popper').rect()).right,
      (await driver.find('.test-ref').rect()).left, 30);
  });
});
