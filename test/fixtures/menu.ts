/**
 * This tests our tooltip implementation.
 */
// tslint:disable:no-console
import {dom, DomElementArg, makeTestId, obsArray, observable, styled, TestId} from 'grainjs';
import {cssMenuDivider, menu, menuItem, menuItemSubmenu} from '../../index';

document.addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(setupTest());
});

const testId: TestId = makeTestId('test-');

const funkyMenu = styled('div', `
  font-size: 18px;
  font-family: serif;
  background-color: DarkGray;
  color: white;
  min-width: 250px;
  box-shadow: 0 0 10px rgba(0, 0, 100, 0.5);
  border: 1px solid white;

  --weaseljs-selected-background-color: white;
  --weaseljs-selected-color: black;
  --weaseljs-menu-item-padding: 20px;
`);

const funkyOptions = {
  menuCssClass: funkyMenu.className,
};

const hideCut = observable(false);
const pasteList = obsArray(['Paste 1']);
let pasteCount: number = 1;

function setupTest() {
  // Create a rectangle, with a button along each edge. Each botton will have 4
  // differently-positioned tooltps, and we'll check that hovering over each one causes 1 tooltip
  // to flip. We'll also include a body-attached tooltip which should overhang the box.
  return cssExample(testId('top'),
    dom('button', 'My Menu', menu(makeMenu)),
    dom('button', 'My Funky Menu', menu(makeFunkyMenu, funkyOptions))
  );
}

function makeMenu(): DomElementArg[] {
  console.log("makeMenu");
  return [
    menuItem(() => { console.log("Menu item: Cut"); }, "Cut", dom.hide(hideCut)),
    menuItemSubmenu(makePasteSubmenu, {}, "Paste Special"),
    menuItem(() => { console.log("Menu item: Copy"); }, "Copy"),
    menuItem(() => {
      console.log("Menu item: Paste");
      pasteList.push(`Paste ${++pasteCount}`);
    }, "Paste"),
    cssMenuDivider(),
    dom.forEach(pasteList, str =>
      menuItem(() => { console.log(`Menu item: ${str}`); }, str)
    ),
    cssMenuDivider(),
    menuItem(() => {
      hideCut.set(!hideCut.get());
      console.log("Menu item: Show/Hide Cut");
    }, dom.text((use) => use(hideCut) ? "Show Cut" : "Hide Cut")),
    cssMenuDivider(),
    menuItemSubmenu(makePasteSubmenu, {}, "Paste Special"),
  ];
}

function makePasteSubmenu(): DomElementArg[] {
  console.log("makePasteSubmenu");
  return [
    menuItem(() => {}, {class: 'disabled'}, "Disabled"),
    menuItem(() => { console.log("Menu item: Cut2"); }, "Cut2"),
    menuItem(() => { console.log("Menu item: Copy2"); }, "Copy2"),
    menuItem(() => { console.log("Menu item: Paste2"); }, "Paste2"),
    menuItemSubmenu(makePasteSubmenu, {}, "Paste Special2"),
  ];
}

function makeFunkyMenu(): DomElementArg[] {
  console.log("makeFunkyMenu");
  return [
    menuItem(() => { console.log("Menu item: Cut"); }, "Cut"),
    menuItemSubmenu(makeFunkySubmenu, funkyOptions, "Paste Special"),
    menuItem(() => { console.log("Menu item: Copy"); }, "Copy"),
    cssMenuDivider(),
    menuItem(() => { console.log("Menu item: Paste"); }, "Paste"),
  ];
}

function makeFunkySubmenu(): DomElementArg[] {
  console.log("makeFunkySubmenu");
  return [
    menuItem(() => { console.log("Menu item: Cut2"); }, "Cut2"),
    menuItem(() => { console.log("Menu item: Copy2"); }, "Copy2"),
    menuItem(() => { console.log("Menu item: Paste2"); }, "Paste2"),
    menuItemSubmenu(makeFunkySubmenu, funkyOptions, "Paste Special2"),
  ];
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

  & button {
    display: block;
    white-space: nowrap;
  }
`);
