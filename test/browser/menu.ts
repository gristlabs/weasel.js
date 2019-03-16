import {assert, driver, Key, useServer} from 'mocha-webdriver';
import {server} from '../fixtures/webpack-test-server';

describe('menu', () => {
  useServer(server);

  before(async function() {
    this.timeout(60000);      // Set a longer default timeout.
    await driver.get(`${server.getHost()}/menu`);
  });

  beforeEach(async function() {
    await driver.find('.test-reset').click();
  });

  async function assertOpen(testId: string, yesNo: boolean) {
    if (yesNo) {
      assert.equal(await driver.find(testId).isDisplayed(), yesNo);
    } else {
      await assert.isRejected(driver.find(testId), /Unable to locate/);
    }
  }

  it('should toggle on trigger click', async function() {
    // Open menu, check we see something.
    await driver.find('.test-btn1').click();
    await assertOpen('.test-menu1', true);
    assert.equal(await driver.find('.test-copy').getText(), 'Copy');

    // Click again to close.
    await driver.find('.test-btn1').click();
    await assertOpen('.test-menu1', false);
    await assert.isRejected(driver.find('.test-copy'), /Unable to locate/);
  });

  it('should take action and close on item click unless disabled', async function() {
    // Open menu.
    await driver.find('.test-btn1').click();
    assert.equal(await driver.find('.test-last').getText(), '');

    // Click a disabled item. Menu should stay open, and no action should run.
    await driver.find('.test-disabled1').click();
    await assertOpen('.test-menu1', true);
    assert.equal(await driver.find('.test-last').getText(), '');

    // Click an item. Check that it runs and menu gets closed.
    await driver.find('.test-copy').click();
    assert.equal(await driver.find('.test-last').getText(), 'Copy');
    await assertOpen('.test-menu1', false);
  });

  it('should close on Escape', async function() {
    await driver.find('.test-btn1').click();
    await assertOpen('.test-menu1', true);
    // Ensure menu closes on Escape.
    await driver.sendKeys(Key.ESCAPE);
    await assertOpen('.test-menu1', false);
  });

  it('should allow navigation and selection with keys', async function() {
    await driver.find('.test-btn1').click();
    // Check that focus changes as we navigate.
    await driver.sendKeys(Key.DOWN);
    assert.equal(await driver.find('.test-cut').hasFocus(), true);
    await driver.sendKeys(Key.DOWN);
    assert.equal(await driver.find('.test-copy').hasFocus(), true);
    // Navigating toward a disabled element skips to the next enabled one.
    await driver.sendKeys(Key.DOWN);
    assert.equal(await driver.find('.test-paste').hasFocus(), true);
    // Navigating back up also skips the disabled element.
    await driver.sendKeys(Key.UP);
    assert.equal(await driver.find('.test-copy').hasFocus(), true);

    // ENTER runs the action and closes.
    await assertOpen('.test-menu1', true);
    assert.equal(await driver.find('.test-last').getText(), '');
    await driver.sendKeys(Key.ENTER);
    assert.equal(await driver.find('.test-last').getText(), 'Copy');
    await assertOpen('.test-menu1', false);
  });

  it('should react to click even if another item is selected', async function() {
    // Use keys to select an item.
    await driver.find('.test-btn1').click();
    await driver.sendKeys(Key.DOWN);
    await driver.sendKeys(Key.DOWN);
    assert.equal(await driver.find('.test-copy').hasFocus(), true);

    // Click a different item, ensure the clicked item is the action that runs.
    await driver.find('.test-cut').click();
    assert.equal(await driver.find('.test-last').getText(), 'Cut');
  });

  it('should act on Enter even if item selected with mouseover', async function() {
    // Move mouse to select an item.
    await driver.find('.test-btn1').click();
    await driver.find('.test-copy').mouseMove();
    assert.equal(await driver.find('.test-copy').hasFocus(), true);

    // Hit Enter to run the action of that item.
    await driver.sendKeys(Key.ENTER);
    assert.equal(await driver.find('.test-last').getText(), 'Copy');
  });

  it('should highlight item on mouseover correctly', async function() {
    await driver.find('.test-btn1').click();
    // Moving the mouse over an item focuses (and selects) the item.
    await driver.find('.test-copy').mouseMove();
    assert.equal(await driver.find('.test-copy').hasFocus(), true);
    // Moving the mouse to a divider deselects the item, leaves menu focused.
    await driver.find('.test-divider1').mouseMove();
    assert.equal(await driver.find('.test-menu1').hasFocus(), true);

    // Move mouse to select another item.
    await driver.find('.test-cut').mouseMove();
    assert.equal(await driver.find('.test-cut').hasFocus(), true);
    // Moving mouse over a disabled item deselects, leaves menu focused.
    await driver.find('.test-disabled1').mouseMove();
    assert.equal(await driver.find('.test-menu1').hasFocus(), true);

    // Move mouse to select an item again.
    await driver.find('.test-cut').mouseMove();
    assert.equal(await driver.find('.test-cut').hasFocus(), true);
    // Moving mouse over body (outside all menus) deselects, leaves menu focused.
    await driver.find('.test-btn1').mouseMove({x: 0, y: -50});
    assert.equal(await driver.find('.test-menu1').hasFocus(), true);
    await driver.withActions((a) => a.click());
    await assertOpen('.test-menu1', false);
  });

  it('should open submenu and act on item clicks', async function() {
    await driver.find('.test-btn1').click();
    await assertOpen('.test-menu1', true);

    // Mouse over on submenu item opens the submenu.
    await driver.find('.test-sub-item').mouseMove();
    await driver.findWait(1, '.test-submenu1');
    await assertOpen('.test-submenu1', true);

    // Click on an item in the submenu runs the action and closes both menus.
    await driver.find('.test-copy2').click();
    assert.equal(await driver.find('.test-last').getText(), 'Copy2');
    await assertOpen('.test-submenu1', false);
    await assertOpen('.test-menu1', false);
  });

  it('should respect keys to open/close/navigate submenu', async function() {
    // Select the submenu item with keyboard (last item).
    await driver.find('.test-btn1').click();
    await driver.sendKeys(Key.UP);
    assert.equal(await driver.find('.test-sub-item').hasFocus(), true);

    // Enter key should open the submenu.
    await assertOpen('.test-submenu1', false);
    await driver.sendKeys(Key.ENTER);
    await assertOpen('.test-submenu1', true);

    // First non-disabled item should be selected.
    assert.equal(await driver.find('.test-cut2').hasFocus(), true);

    // LEFT key should close.
    await driver.sendKeys(Key.LEFT);
    await assertOpen('.test-submenu1', false);
    assert.equal(await driver.find('.test-sub-item').hasFocus(), true);

    // RIGHT key should reopen.
    await driver.sendKeys(Key.RIGHT);
    await assertOpen('.test-submenu1', true);
    assert.equal(await driver.find('.test-cut2').hasFocus(), true);

    // UP/DOWN navigate.
    await driver.sendKeys(Key.DOWN);
    assert.equal(await driver.find('.test-copy2').hasFocus(), true);
    await driver.sendKeys(Key.UP, Key.UP);  // Wrap around top.
    assert.equal(await driver.find('.test-sub-item2').hasFocus(), true);
    await driver.sendKeys(Key.UP);
    assert.equal(await driver.find('.test-paste2').hasFocus(), true);

    // ESCAPE should close both menus.
    await driver.sendKeys(Key.ESCAPE);
    await assertOpen('.test-submenu1', false);
    await assertOpen('.test-menu1', false);
    // No actions were performed.
    assert.equal(await driver.find('.test-last').getText(), '');
  });

  it('should close submenu when a different parent item is selected', async function() {
    // Opent the menu and submenu.
    await driver.find('.test-btn1').click();
    await driver.find('.test-sub-item').mouseMove();
    await driver.findWait(1, '.test-submenu1');
    await assertOpen('.test-submenu1', true);

    // Mouse over a different parent item.
    await driver.find('.test-cut').mouseMove();
    await assertOpen('.test-submenu1', false);
  });
});