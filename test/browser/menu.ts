import {addToRepl, assert, driver, Key, useServer} from 'mocha-webdriver';
import {server} from '../fixtures/webpack-test-server';
import {assertOpen} from './utils';

describe('menu', () => {
  useServer(server);
  addToRepl('Key', Key, 'key values such as Key.ENTER');

  before(async function() {
    this.timeout(60000);      // Set a longer default timeout.
    await driver.get(`${server.getHost()}/menu`);
  });

  beforeEach(async function() {
    await driver.find('.test-reset').click();
  });

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

  it('should open on contextmenu', async function() {
    // Open contextmenu, check we see something.
    const btn = await driver.find('.test-btn2');
    await driver.withActions((a: any) => a.contextClick(btn));
    await assertOpen('.test-menu1', true);
    assert.equal(await driver.find('.test-copy').getText(), 'Copy');

    // Open contextmenu again, should reopen
    await driver.withActions((a: any) => a.contextClick(btn));
    await assertOpen('.test-menu1', true);
    assert.equal(await driver.find('.test-copy').getText(), 'Copy');

    // Click element, should close
    await btn.click();
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
    await driver.find('.test-btn1').mouseMove().click();
    await driver.find('.test-copy').mouseMove();
    assert.equal(await driver.find('.test-copy').hasFocus(), true);

    // Hit Enter to run the action of that item.
    await driver.sendKeys(Key.ENTER);
    assert.equal(await driver.find('.test-last').getText(), 'Copy');
  });

  it('should highlight item on mouseover correctly', async function() {
    await driver.find('.test-btn1').mouseMove().click();
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
    await driver.find('.test-btn1').mouseMove().click();
    await assertOpen('.test-menu1', true);

    // Mouse over on submenu item opens the submenu.
    await driver.find('.test-sub-item').mouseMove();
    await driver.findWait('.test-submenu1', 1000);
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

    // Clicking on a disabled element should do nothing. Menu should stay open, and no action
    // should run.
    await driver.find('.test-disabled2').click();
    await assertOpen('.test-submenu1', true);
    await assertOpen('.test-menu1', true);
    assert.equal(await driver.find('.test-last').getText(), '');

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
    await driver.find('.test-btn1').mouseMove().click();
    await driver.find('.test-sub-item').mouseMove();
    await driver.findWait('.test-submenu1', 1000);
    await assertOpen('.test-submenu1', true);

    // Mouse over a different parent item.
    await driver.find('.test-cut').mouseMove();
    await assertOpen('.test-submenu1', false);
    await assertOpen('.test-menu1', true);
    await driver.sendKeys(Key.ESCAPE);
    await assertOpen('.test-menu1', false);
  });

  it('should support setOpenClass() while a menu is open', async function() {
    // Fixture code sets the default css class (.weasel-popup-open) on the example div
    // (.test-top), and a custom css class (.custom-menu-open) on <body>.
    assert.notInclude(await driver.find('.test-top').getAttribute('class'), 'weasel-popup-open');
    assert.notInclude(await driver.find('body').getAttribute('class'), 'custom-menu-open');

    await driver.find('.test-btn1').click();
    await assertOpen('.test-menu1', true);
    assert.include(await driver.find('.test-top').getAttribute('class'), 'weasel-popup-open');
    assert.include(await driver.find('body').getAttribute('class'), 'custom-menu-open');

    await driver.sendKeys(Key.ESCAPE);
    await assertOpen('.test-menu1', false);
    assert.notInclude(await driver.find('.test-top').getAttribute('class'), 'weasel-popup-open');
    assert.notInclude(await driver.find('body').getAttribute('class'), 'custom-menu-open');
  });

  it('should not steal focus set by menu actions', async function() {
    // First check that open/close leaves the menu-trigger button focused.
    await driver.find('.test-btn1').click();
    await driver.sendKeys(Key.ESCAPE);
    await assertOpen('.test-menu1', false);
    assert.equal(await driver.find('.test-btn1').hasFocus(), true);

    // Now click the "Focus Reset" menu item which SHOULD focus the Reset button. We are making
    // sure that focus does NOT get restored to the menu-trigger button if an action changed it.
    await driver.find('.test-btn1').click();
    await driver.find('.test-focus-reset').click();
    await assertOpen('.test-menu1', false);
    assert.equal(await driver.find('.test-btn1').hasFocus(), false);
    assert.equal(await driver.find('.test-reset').hasFocus(), true);
  });

  it('should not steal focus from input triggers', async function() {
    // Check that menus set to input triggers open without stealing input focus.
    await driver.find('.test-input1').click();
    await driver.sendKeys('abcdefg');
    assert.equal(await driver.find('.test-input1').getAttribute('value'), 'abcdefg');

    // Check that enter triggers the input enter command, which clear the input.
    await driver.sendKeys(Key.ENTER);
    assert.equal(await driver.find('.test-input1').getAttribute('value'), '');
    await driver.sendKeys(Key.ESCAPE);
  });

  it('should allow keyboard navigation from input triggers', async function() {
    // Check that input triggers allow closing the menu.
    await driver.find('.test-input1').click();
    await driver.sendKeys('hello');
    await assertOpen('.test-input1-menu', true);
    await driver.sendKeys(Key.ESCAPE);
    await assertOpen('.test-input1-menu', false);

    // Check that input triggers allow navigation to menu items.
    await driver.sendKeys('a');
    await driver.sendKeys(Key.DOWN);
    assert.equal(await driver.find('.test-input1-menu-item').hasFocus(), true);

    // Check that enter triggers the menu item command, which closes the menu but does
    // not clear the input.
    await driver.sendKeys(Key.ENTER);
    await assertOpen('.test-input1-menu', false);
    assert.equal(await driver.find('.test-input1').getAttribute('value'), 'helloa');
  });

  it('should allow nothing selected with navigating navigation', async function() {
    await driver.find('.test-btn5').click();
    assert.deepEqual(await findSelected(), []);

    // moving down once should select 'Cut'
    await driver.sendKeys(Key.DOWN);
    assert.deepEqual(await findSelected(), ['Cut']);

    // moving up once should select nothing
    await driver.sendKeys(Key.UP);
    assert.deepEqual(await findSelected(), []);

    // moving up once should select 'Paste'
    await driver.sendKeys(Key.UP);
    assert.deepEqual(await findSelected(), ['Paste Special\n▶']);

    // moving down once should select nothing
    await driver.sendKeys(Key.DOWN);
    assert.deepEqual(await findSelected(), []);

    function findSelected() {
      return driver.findAll('li[class*=-sel]', (e) => e.getText());
    }

  });

});
