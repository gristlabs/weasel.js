import {assert, driver, stackWrapFunc} from 'mocha-webdriver';

// Check whether a menu is opened and handle failure with useful messages. Expects `selector` to
// select a menu element in the dom.
export const assertOpen = stackWrapFunc(async function(selector: string, yesNo: boolean) {
  const elemPromise = driver.find(selector);
  assert.equal(await elemPromise.isPresent() && await elemPromise.isDisplayed(), yesNo,
               `Menu ${selector} is not ${yesNo ? 'open' : 'closed'}`);
});

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
