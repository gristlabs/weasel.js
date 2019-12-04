import { addToRepl, assert, driver, Key, useServer } from 'mocha-webdriver';
import { server } from '../fixtures/webpack-test-server';
import { assertOpen } from './utils';

describe('autocomplete', () => {
  useServer(server);
  addToRepl('Key', Key, 'key values such as Key.ENTER');

  before(async function() {
    this.timeout(60000);      // Set a longer default timeout.
    await driver.get(`${server.getHost()}/menu`);
  });

  beforeEach(async function() {
    await driver.find('.test-reset').click();
  });

  it('should have a functional autocomplete', async function() {
    this.timeout(10000);

    // Check that the autocomplete opens when the input is focused.
    const input = await driver.find('.test-autocomplete1');
    await input.click();
    await assertOpen('.test-menu-autocomplete1', true);
    assert.equal(await driver.findContent('li', /Thomas/).isPresent(), true);
    assert.deepEqual(await driver.findAll('li[class*=-sel]', (e) => e.getText()), []);

    // Type 't' and check that Thomas is selected.
    await input.sendKeys('t');
    assert.deepEqual(await driver.findAll('li[class*=-sel]', (e) => e.getText()), ['Thomas']);

    // Hit enter and check that the input is set to 'Thomas'.
    await input.sendKeys(Key.ENTER);
    assert.equal(await input.getAttribute('value'), 'Thomas');
    await assertOpen('.test-menu-autocomplete1', false);

    // Reset input focus
    await driver.find('.test-top').click();
    await input.click();
    for (let i = 0; i < 6; i++) { await input.sendKeys(Key.BACK_SPACE); }

    // Type 'mar' and check that Mark is selected.
    await input.sendKeys('mar');
    assert.deepEqual(await driver.findAll('li[class*=-sel]', (e) => e.getText()), ['Mark']);

    // Type 'j' and check that Marjorey is selected.
    await input.sendKeys('j');
    assert.deepEqual(await driver.findAll('li[class*=-sel]', (e) => e.getText()), ['Marjorey']);

    // Use down arrow 3x and check that June is selected and that the input is set to June
    for (let i = 0; i < 3; i++) { await input.sendKeys(Key.DOWN); }
    assert.deepEqual(await driver.findAll('li[class*=-sel]', (e) => e.getText()), ['June']);
    assert.equal(await input.getAttribute('value'), 'June');

    // Use DELETE 4 times and check that nothing is selected
    for (let i = 0; i < 4; i++) { await driver.sendKeys(Key.BACK_SPACE); }
    assert.deepEqual(await driver.findAll('li[class*=-sel]', (e) => e.getText()), []);
    assert.equal(await input.getAttribute('value'), '');

    // Click on 'Marc' on check that the input is set to Marc and the autocomplete is closed
    await driver.findContent('li', 'Mark').click();
    assert.equal(await input.getAttribute('value'), 'Mark');
    await assertOpen('.test-menu-autocomplete1', false);
  });
});
