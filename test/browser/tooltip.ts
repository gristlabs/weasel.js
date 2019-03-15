import {assert, driver, useServer, WebElement} from 'mocha-webdriver';
import {server} from '../fixtures/webpack-test-server';

type RelPos = 'above'|'below'|'leftOf'|'rightOf';
async function assertPosition(a: WebElement, b: WebElement, rel: RelPos, delta: number): Promise<void> {
  const ar: ClientRect = await a.rect();
  const br: ClientRect = await b.rect();
  switch (rel) {
    case 'above': return assert.closeTo(ar.bottom, br.top, delta);
    case 'below': return assert.closeTo(ar.top, br.bottom, delta);
    case 'leftOf': return assert.closeTo(ar.right, br.left, delta);
    case 'rightOf': return assert.closeTo(ar.left, br.right, delta);
  }
}

describe('tooltip', () => {
  useServer(server);

  before(async function() {
    this.timeout(60000);      // Set a longer default timeout.
    await driver.get(`${server.getHost()}/tooltip`);
  });

  it('should normally position relative to window', async function() {
    this.timeout(20000);
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const button = await driver.findContent('.test-top button', new RegExp(`Body ${side}`)).mouseMove();
      await driver.sleep(10);
      await assertPosition(driver.findContent('div', /body top/), button, 'above', 20);
      await assertPosition(driver.findContent('div', /body right/), button, 'rightOf', 20);
      await assertPosition(driver.findContent('div', /body bottom/), button, 'below', 20);
      await assertPosition(driver.findContent('div', /body left/), button, 'leftOf', 20);
    }
  });

  it('should position relative to an element if requested', async function() {
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const button = await driver.findContent('.test-top button', new RegExp(`Parent ${side}`)).mouseMove();
      await driver.sleep(10);
      await assertPosition(driver.findContent('div', /parent top/), button,
        side === 'Top' ? 'below' : 'above', 20);
      await assertPosition(driver.findContent('div', /parent right/), button,
        side === 'Right' ? 'leftOf' : 'rightOf', 20);
      await assertPosition(driver.findContent('div', /parent bottom/), button,
        side === 'Bottom' ? 'above' : 'below', 20);
      await assertPosition(driver.findContent('div', /parent left/), button,
        side === 'Left' ? 'rightOf' : 'leftOf', 20);
    }
  });
});
