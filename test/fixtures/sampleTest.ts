/**
 * This test is really only here to make sure we can run browser tests.
 * It comes from a similar test in grainjs and doesn't test anything code of our own.
 */

import {computed, dom, input, obsArray} from 'grainjs';

function setupTest() {
  const values = obsArray<string>([]);
  const merged = computed((use) => use(values).join(","))
    .onWrite((val) => values.set(val.split(",")));

  return dom('div',
    dom('div#in1', input(merged, {})),
    dom('ul#out1',
      dom.forEach(values, (value: string) =>
        dom('li', '+' + value)
      )
    )
  );
}

document.body.appendChild(setupTest());
