/**
 * Settings that affect tests using mocha-webdriver. This module is imported by any run of mocha, by
 * being listed in test/mocha.opts.
 */
"use strict";

// Enable enhanced stacktraces by default. Disable by running with MOCHA_WEBDRIVER_STACKTRACES="".
if (process.env.MOCHA_WEBDRIVER_STACKTRACES === undefined) {
  process.env.MOCHA_WEBDRIVER_STACKTRACES = "1";
}

// Don't fail on mismatched Chrome versions. Disable with MOCHA_WEBDRIVER_IGNORE_CHROME_VERSION="".
if (process.env.MOCHA_WEBDRIVER_IGNORE_CHROME_VERSION === undefined) {
  process.env.MOCHA_WEBDRIVER_IGNORE_CHROME_VERSION = "1";
}
