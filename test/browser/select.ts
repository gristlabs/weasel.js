import {assert, driver, Key, useServer} from 'mocha-webdriver';
import {server} from '../fixtures/webpack-test-server';
import {assertOpen} from './utils';

describe('select', () => {
  useServer(server);

  before(async function() {
    this.timeout(60000);      // Set a longer default timeout.
    await driver.get(`${server.getHost()}/menu`);
  });

  beforeEach(async function() {
    await driver.find('.test-reset').click();
  });

  it('should use ARIA attributes', async function() {
    const trigger = await driver.find('.test-btn3');
    assert.equal((await trigger.getTagName()).toLowerCase(), 'button');
    assert.equal(await trigger.getAttribute('aria-haspopup'), 'listbox');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.notOk(await trigger.getAttribute('aria-controls'));

    await trigger.click();
    await assertOpen('.test-select-dropdown', true);

    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    const listId = await trigger.getAttribute('aria-controls');
    assert.match(listId!, /^weasel-element-\d+$/);
    assert.equal(await trigger.getAttribute('aria-owns'), listId);

    const list = await driver.find(`#${listId}`);
    assert.equal(await list.getAttribute('role'), 'listbox');
    assert.equal(await list.getAttribute('aria-orientation'), 'vertical');

    const avocado = await driver.findContent('[role="option"]', /avocado/);
    assert.equal(await avocado.getAttribute('role'), 'option');
    assert.equal(await avocado.getAttribute('aria-selected'), 'true');

    const apple = await driver.findContent('[role="option"]', /apple/);
    assert.equal(await apple.getAttribute('aria-selected'), 'false');

    await driver.sendKeys(Key.ESCAPE);
    await assertOpen('.test-select-dropdown', false);
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.notOk(await trigger.getAttribute('aria-controls'));
    assert.notOk(await trigger.getAttribute('aria-owns'));
  });

  it('should open on Enter key', async function() {
    const trigger = await driver.find('.test-btn3');
    await trigger.click();
    await assertOpen('.test-select-dropdown', true);
    await driver.sendKeys(Key.ESCAPE);
    await assertOpen('.test-select-dropdown', false);

    await driver.sendKeys(Key.ENTER);
    await assertOpen('.test-select-dropdown', true);
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    await driver.sendKeys(Key.ESCAPE);
  });

  it('should expose aria-disabled on disabled options', async function() {
    await driver.find('.test-btn4').click();
    await assertOpen('.test-select-dropdown', true);
    const bob = await driver.findContent('[role="option"]', /Bob/);
    assert.isTrue(await bob.matches('.disabled'));
    assert.equal(await bob.getAttribute('aria-disabled'), 'true');
    const alice = await driver.findContent('[role="option"]', /Alice/);
    assert.isNull(await alice.getAttribute('aria-disabled'));
    await alice.click();
    await assertOpen('.test-select-dropdown', false);
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

  it('should handle the selected element being disabled', async function() {
    await driver.find('.test-btn4b').click();
    await driver.findWait('.test-select-dropdown', 100);
    const french = await driver.findContent('li', /French/);
    assert.isTrue(await french.matches('[class*=-sel]'), 'Selected element on open should be the disabled one (French)');

    await driver.sendKeys(Key.DOWN);
    const german = await driver.findContent('li', /German/);
    assert.isTrue(await german.matches('[class*=-sel]'), 'Selected element after down arrow should be the next one (German)');

    await driver.sendKeys(Key.UP);
    const english = await driver.findContent('li', /English/);
    assert.isTrue(await english.matches('[class*=-sel]'), 'Selected element after up arrow should be the one before French (English)');

    await driver.sendKeys(Key.ESCAPE);
    assert.match(await driver.find('.test-btn4b').getText(), /French/, 'Escaping should keep the disabled element as value (French)');
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

  it('should support the modifyContent argument to customize the dropdown element', async function() {
    await driver.find('.test-btn3').click();
    assert.equal(await driver.findWait('.test-select-dropdown', 100).getAttribute('data-modify-content-attr'), 'select');
    await driver.sendKeys(Key.ESCAPE);
  });
});
