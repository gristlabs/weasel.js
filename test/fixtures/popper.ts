/**
 * This is a test of basic functionality of popper.js library which we use here. It checks that
 * the popper library is present and functional, and that we can run browser tests to test it, and
 * it serves as an exercise in using the library, but it doesn't test any code of weasel.js.
 *
 * It reproduces a basic popper example from popper.js.org main page, using their styles.
 */

import {dom, makeTestId, observable, select, styled, subscribe, TestId} from 'grainjs';
import Popper from 'popper.js';

document.addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(setupTest());
});

const testId: TestId = makeTestId('test-');

function setupTest() {
  const position = observable<Popper.Placement>("top");
  let popper: Popper;
  let topEl: Element;
  let refEl: Element;
  let popperEl: Element;
  topEl = cssExample(
    refEl = cssExampleRef(
      dom('p', 'Hey!'),
      dom('p', 'Choose where to put your popper!'),
      dom.update(
        select(position, [
          {value: 'top', label: 'Top'},
          {value: 'right', label: 'Right'},
          {value: 'bottom', label: 'Bottom'},
          {value: 'left', label: 'Left'},
        ]),
        cssExamplePosSelector.cls(''),
      ),
      testId('ref'),
    ),
    popperEl = cssExamplePopper(
      dom('p', 'Popper on ', dom('b', dom.text((use) => use(position)))),
      cssExamplePopperArrow(),
      testId('popper'),
    ),
  );

  subscribe(position, (use, _position) => {
    if (popper) { popper.destroy(); }
    popper = new Popper(refEl, popperEl, {
      placement: _position,
      modifiers: {
        preventOverflow: {
          boundariesElement: topEl,
        },
      },
    });
  });

  return cssSection(topEl);
}

// This is a hack: creation of such a styled element adds a '*' clause to CSS affecting elements.
styled('div', `
  * { box-sizing: border-box; }
`);

const cssSection = styled('div', `
  background-color: #2e3842;
  color: #a6e0db;
  font-size: 100%;
  font-family: sans-serif;
  vertical-align: baseline;

  & b {
    font-weight: 900;
  }
`);

const cssExample = styled('div', `
  order: 1;
  position: relative;
  min-height: 450px;
  width: 40%;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-content: center;
  align-items: center;
`);

const cssExampleRef = styled('div', `
  width: 30%;
  margin: 0 auto;
  position: relative;
  text-align: center;
  padding: 20px;
  border-style: dotted;
  border-color: white;
  border-width: medium;
`);

const cssExamplePosSelector = styled('select', `
  appearance: none;
  background: rgba(144,144,144,0.25);
  border-radius: 3px;
  border: none;
  color: inherit;
  display: block;
  outline: 0;
  padding: 0 1em;
  text-decoration: none;
  width: 100%;
  height: 2.75em;
  margin-top: 1em;

  & > option {
    color: black;
  }

  &:focus {
    box-shadow: 0 0 0 2px #21b2a6;
  }
`);

const cssExamplePopper = styled('div', `
  position: absolute;
  background: #FFC107;
  color: black;
  width: 150px;
  border-radius: 3px;
  box-shadow: 0 0 2px rgba(0,0,0,0.5);
  padding: 10px;
  text-align: center;

  &[x-placement^="bottom"] { margin-top: 5px; }
  &[x-placement^="top"] { margin-bottom: 5px; }
  &[x-placement^="left"] { margin-right: 5px; }
  &[x-placement^="right"] { margin-left: 5px; }
`);

const cssExamplePopperArrow = styled('div', `
  width: 0;
  height: 0;
  border-style: solid;
  border-color: #FFC107;
  position: absolute;
  margin: 5px;

  .${cssExamplePopper.className}[x-placement^="bottom"] & {
    border-width: 0 5px 5px 5px;
    border-left-color: transparent;
    border-right-color: transparent;
    border-top-color: transparent;
    top: -5px;
    left: calc(50% - 5px);
    margin-top: 0;
    margin-bottom: 0;
  }
  .${cssExamplePopper.className}[x-placement^="top"] & {
    border-width: 5px 5px 0 5px;
    border-left-color: transparent;
    border-right-color: transparent;
    border-bottom-color: transparent;
    bottom: -5px;
    left: calc(50% - 5px);
    margin-top: 0;
    margin-bottom: 0;
  }
  .${cssExamplePopper.className}[x-placement^="left"] & {
    border-width: 5px 0 5px 5px;
    border-top-color: transparent;
    border-right-color: transparent;
    border-bottom-color: transparent;
    right: -5px;
    top: calc(50% - 5px);
    margin-left: 0;
    margin-right: 0;
  }
  .${cssExamplePopper.className}[x-placement^="right"] & {
    border-width: 5px 5px 5px 0;
    border-left-color: transparent;
    border-top-color: transparent;
    border-bottom-color: transparent;
    left: -5px;
    top: calc(50% - 5px);
    margin-left: 0;
    margin-right: 0;
  }
`);
