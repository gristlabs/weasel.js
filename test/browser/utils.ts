import {assert, driver} from 'mocha-webdriver';

// Check whether a menu is opened and handle failure with useful messages. Expects `selector` to
// select a menu element in the dom.
export async function assertOpen(selector: string, yesNo: boolean) {
  if (yesNo) {
    const elem = driver.findWait(selector, 100);
    assert.equal(await elem.isPresent() && await elem.isDisplayed(), true,
      `Menu ${selector} is not open`);
  } else {
    await driver.sleep(50);
    assert.equal(await driver.find(selector).isPresent(), false,
      `Menu ${selector} is not closed`);
  }
}

// Rerun check until it pass or `timeMs` elapsed.
export async function waitToPass(check: () => Promise<void>, timeMs: number = 4000) {
  try {
    await driver.wait(async () => {
      try {
        await check();
      } catch (e) {
        return false;
      }
      return true;
    }, timeMs);
  } catch (e) {
    await check();
  }
}
