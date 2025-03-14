import {assert, driver, Key, useServer} from 'mocha-webdriver';
import {server} from '../fixtures/webpack-test-server';

describe('select', () => {
  useServer(server);

  before(async function() {
    this.timeout(60000);      // Set a longer default timeout.
    await driver.get(`${server.getHost()}/menu`);
  });

  beforeEach(async function() {
    await driver.find('.test-reset').click();
  });

  it('should open to selected element', async function() {
    // Check that the initial element is selected on open.
    await driver.find('.test-btn3').click();
    await driver.findWait('.test-select-dropdown', 100);
    const avocado = await driver.findContent('li', /avocado/);
    assert.isTrue(await avocado.matches('[class*=-sel]'));

    // Select a new element.
    await driver.findContent('li', /kiwi/).click();

    // Check that the new element is selected on open.
    await driver.find('.test-btn3').click();
    await driver.findWait('.test-select-dropdown', 100);
    const kiwi = await driver.findContent('li', /kiwi/);
    assert.isTrue(await kiwi.matches('[class*=-sel]'));
    await driver.sendKeys(Key.ESCAPE);
  });

  it('should allow typing to change selection when open', async function() {
    // Open the menu, type, and check selected.
    await driver.find('.test-btn4').click();
    await driver.findWait('.test-select-dropdown', 100);
    await driver.sendKeys('e');
    assert.isTrue(await driver.findContent('li', /Eve/).matches('[class*=-sel]'));
    await driver.sleep(1000); // Sleep to clear text input.

    // Check that pressing the same key cycles through options starting with that letter.
    await driver.sendKeys('a');
    assert.isTrue(await driver.findContent('li', /Alice/).matches('[class*=-sel]'));
    await driver.sendKeys('a');
    assert.isTrue(await driver.findContent('li', /Amy/).matches('[class*=-sel]'));
    await driver.sendKeys('a');
    assert.isTrue(await driver.findContent('li', /Alice/).matches('[class*=-sel]'));
    await driver.sendKeys('m');
    assert.isTrue(await driver.findContent('li', /Amy/).matches('[class*=-sel]'));

    // Check that arrow keys adjust the selected element as well.
    await driver.sendKeys(Key.DOWN);
    assert.isTrue(await driver.findContent('li', /Eve/).matches('[class*=-sel]'));
    await driver.sendKeys(Key.ESCAPE);
  });

  it('should allow typing to selection when closed', async function() {
    this.timeout(5000);

    // Open the menu, then close it to gain focus.
    await driver.find('.test-btn3').click();
    await driver.findWait('.test-select-dropdown', 100);
    await driver.sendKeys(Key.ESCAPE);

    // Assert that kiwi is selected.
    assert.equal(await driver.find('.test-btn3').getText(), 'kiwi');

    // Type to adjust the selected element.
    await driver.sendKeys('m');
    assert.equal(await driver.find('.test-btn3').getText(), 'mango');
    await driver.sleep(1000); // Sleep to clear text input.

    // Check that pressing the same key cycles through options starting with that letter.
    await driver.sendKeys('a');
    assert.equal(await driver.find('.test-btn3').getText(), 'apple');
    await driver.sendKeys('a');
    assert.equal(await driver.find('.test-btn3').getText(), 'apricot');
    await driver.sendKeys('a');
    assert.equal(await driver.find('.test-btn3').getText(), 'avocado');
    await driver.sendKeys('a');
    assert.equal(await driver.find('.test-btn3').getText(), 'apple');
    await driver.sendKeys('v');
    assert.equal(await driver.find('.test-btn3').getText(), 'avocado');
    await driver.sleep(1000); // Sleep to clear text input.

    // Check that longer inputs work.
    await driver.sendKeys('a');
    assert.equal(await driver.find('.test-btn3').getText(), 'apple');
    await driver.sendKeys('p');
    assert.equal(await driver.find('.test-btn3').getText(), 'apple');
    await driver.sendKeys('r');
    assert.equal(await driver.find('.test-btn3').getText(), 'apricot');

    // Check that arrow keys open the menu to the selected element.
    await driver.sendKeys(Key.DOWN);
    await driver.findWait('.test-select-dropdown', 100);
    assert.isTrue(await driver.findContent('li', /apricot/).matches('[class*=-sel]'));
    await driver.sendKeys(Key.ESCAPE);
  });
});
