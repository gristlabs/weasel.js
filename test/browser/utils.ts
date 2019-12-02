import {assert, driver, stackWrapFunc} from 'mocha-webdriver';

// Check whether a menu is opened and handle failure with useful messages. Expects `selector` to
// select a menu element in the dom.
export const assertOpen = stackWrapFunc(async function(selector: string, yesNo: boolean) {
  const elemPromise = driver.find(selector);
  assert.equal(await elemPromise.isPresent() && await elemPromise.isDisplayed(), yesNo,
               `Menu ${selector} is not ${yesNo ? 'open' : 'closed'}`);
});
