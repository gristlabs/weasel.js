import {assert, driver, Key, promise, useServer, WebElement} from 'mocha-webdriver';
import {server} from '../fixtures/webpack-test-server';

describe('sampleTest', () => {
  useServer(server);

  before(async function() {
    this.timeout(60000);      // Set a longer default timeout.
    await driver.get(`${server.getHost()}/sampleTest`);
  });

  async function getText(elems: promise.Promise<WebElement[]>): Promise<string[]> {
    return Promise.all((await elems).map((elem) => elem.getText()));
  }

  it('should respond to changing obsArray', async function() {
    assert.deepEqual(await getText(driver.findAll('#out1 li')), []);

    await driver.find('#in1 input').sendKeys("foo", Key.ENTER);
    assert.deepEqual(await getText(driver.findAll('#out1 li')), ["+foo"]);

    await driver.find('#in1 input').sendKeys(",bar,baz", Key.ENTER);
    assert.deepEqual(await getText(driver.findAll('#out1 li')), ["+foo", "+bar", "+baz"]);

    await driver.find('#in1 input').doClear().doSendKeys("Hello,World", Key.ENTER);
    assert.deepEqual(await getText(driver.findAll('#out1 li')), ["+Hello", "+World"]);
  });
});
