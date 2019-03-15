/**
 * This tests our tooltip implementation.
 */

import {dom, DomElementMethod, makeTestId, styled, TestId} from 'grainjs';
import {darkTooltipTheme, ITooltipOptions, tooltip} from '../../index';

document.addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(setupTest());
});

const testId: TestId = makeTestId('test-');

function setupTest() {
  // Create a rectangle, with a button along each edge. Each botton will have 4
  // differently-positioned tooltps, and we'll check that hovering over each one causes 1 tooltip
  // to flip. We'll also include a body-attached tooltip which should overhang the box.
  return cssExample(testId('top'),
    dom('div.side', {style: 'top: 20px; margin-top: auto;'},
      dom('button', 'Body Top', addTooltips('body')),
      dom('button', 'Parent Top', addTooltips('parent', 'scrollParent'))),
    dom('div.side', {style: 'right: 20px; margin-right: auto;'},
      dom('button', 'Body Right', addTooltips('body')),
      dom('button', 'Parent Right', addTooltips('parent', 'scrollParent'))),
    dom('div.side', {style: 'bottom: 20px; margin-bottom: auto;'},
      dom('button', 'Body Bottom', addTooltips('body')),
      dom('button', 'Parent Bottom', addTooltips('parent', 'scrollParent'))),
    dom('div.side', {style: 'left: 20px; margin-left: auto;'},
      dom('button', 'Body Left', addTooltips('body')),
      dom('button', 'Parent Left', addTooltips('parent', 'scrollParent'))),
  );
}

function addTooltips(prefix: string, boundaries?: ITooltipOptions["boundaries"]): DomElementMethod {
  return (elem) => {
    dom.update(elem,
      tooltip({placement: 'top', title: `${prefix} top`, boundaries}),
      tooltip({placement: 'right', title: `${prefix} right`, boundaries, theme: darkTooltipTheme}),
      tooltip({placement: 'bottom', title: `${prefix} bottom`, boundaries}),
      tooltip({placement: 'left', title: `${prefix} left`, boundaries}),
    );
  };
}

const cssExample = styled('div', `
  position: relative;
  overflow: auto;
  margin-left: 250px;
  margin-top: 50px;
  background-color: grey;
  color: white;
  font-size: 100%;
  font-family: sans-serif;
  vertical-align: baseline;
  height: 300px;
  width: 500px;

  & .side {
    position: absolute;
    display: block;
    width: 80px;
    height: 30px;
    margin-top: calc(300px / 2 - 15px);
    margin-left: calc(500px / 2 - 40px);
    margin-bottom: calc(300px / 2 - 15px);
    margin-right: calc(500px / 2 - 40px);
  }
  & button {
    display: block;
    white-space: nowrap;
  }
`);
