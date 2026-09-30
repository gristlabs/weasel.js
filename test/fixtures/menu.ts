/**
 * This tests our tooltip implementation.
 */
// tslint:disable:no-console
import {dom, DomElementArg, input, IOption, makeTestId, MaybeObsArray, obsArray, observable, styled, TestId} from 'grainjs';
import {cssMenuDivider, cssMenuItem, isSelectable, menu, menuGroup, menuItem, menuItemCheckbox, menuItemLink, menuItemSubmenu, popupOpen} from '../../index';
import {IOpenController, PopupControl} from '../../index';
import {autocomplete, inputMenu, select} from '../../index';

const testId: TestId = makeTestId('test-');
const lastAction = observable("");
const inputObs = observable("");
const disableSelect = observable(false);
let resetBtn: HTMLElement;

const employees = observable([
  {value: 12, label: "Bob", disabled: true},
  {value: 17, label: "Alice"},
  {value: 13, label: "Amy"},
  {value: 21, label: "Eve"},
  {value: 19, label: "James"},
  {value: 18, label: "Wolfeschlegelsteinhausenbergerdorff"}
]);

const languages = observable([
  {value: 'en', label: 'English'},
  {value: 'fr', label: 'French', disabled: true},
  {value: 'de', label: 'German'},
  {value: 'it', label: 'Italian', disabled: true},
  {value: 'pt', label: 'Portuguese'},
  {value: 'es', label: 'Spanish'},
]);

function setupTest() {
  function submitInput() {
    console.log("Enter key triggered on input");
    inputObs.set("");
  }
  // Triggers the input menu on 'input' events, if the input has text inside.
  function inputTrigger(triggerElem: Element, ctl: PopupControl): void {
    dom.onElem(triggerElem, 'input', () => {
      (triggerElem as HTMLInputElement).value.length > 0 ? ctl.open() : ctl.close();
    });
  }

  return cssExample(testId('top'),
    cssResetButton('Back to top',
      dom.on('click', () => lastAction.set('')), testId('reset-top')
    ),
    cssButtonsContainer(
      // tabindex makes it focusable, allowing us to test focus restore issues.
      cssButton('My Menu',
        testId('btn1'),
        { tabindex: "0", role: "button" },
        menu(makeMenu, {
          parentSelectorToMark: '.' + cssExample.className,
          trigger: ['click', {keys: ['Enter']}],
        })
      ),
      cssButton('My Contextmenu',
        testId('btn2'),
        { tabindex: "-1", role: "button" },
        menu(makeMenu, {
          trigger: ['contextmenu'],
          parentSelectorToMark: '.' + cssExample.className
        })
      ),
      dom('button', testId('btn-native'), 'My Funky Menu', menu(makeFunkyMenu, funkyOptions)),
      cssButton('My Menu that allow nothing selected',
        {tabindex: '-1'},
        testId('btn5'),
        menu(makeMenu, {allowNothingSelected: true}),
      ),
      cssButton('My Menu with modifyContent arg',
        testId('btn-modify-content'),
        menu(() => [
          testId('modify-content-menu'),
          menuItem(() => console.log('Menu item: ModifyContent'), 'ModifyContent', testId('modify-content-item')),
        ], {
          modifyContent: (menuEl, ctl) => {
            ctl.setOpenClass(menuEl, 'modify-content-open-class');
          },
        }),
      ),
      cssButton('My Menu with only checkbox items',
        {tabindex: '0'},
        testId('btn-only-checkbox-items'),
        menu(() => [
          testId('only-checkbox-items-menu'),
          makeCheckboxItem('Checkbox 1'),
          makeCheckboxItem('Checkbox 2', {"aria-disabled": "true"}),
          makeCheckboxItem('Checkbox 3'),
        ]),
      ),
      cssButton('My Menu with only disabled items',
        {tabindex: '0'},
        testId('btn-only-disabled-items'),
        menu(() => [
          testId('only-disabled-items-menu'),
          menuItem(() => {}, 'Disabled stuff', dom.cls('disabled')),
          menuItem(() => {}, 'Disabled stuff', dom.attr('aria-disabled', 'true')),
          menuItem(() => {}, 'Disabled stuff', dom.cls('disabled')),
        ]),
      ),
      cssButton('My Menu with mixed content',
        {tabindex: '0'},
        testId('btn-other-things'),
        menu(() => [
          testId('other-things-menu'),
          makeCheckboxItem('Checkbox test'),
          menuItem(() => lastAction.set("Hello"), "Hello", testId('hello')),
          dom(
            'div',
            'Non-selectable (no tabindex)',
            {role: 'menuitem', class: cssMenuItem.className},
            dom.on('click', (_, elem) => isSelectable(elem) && lastAction.set('Non-selectable (no tabindex)'))
          ),
          menuItem(() => lastAction.set("Hola"), "Hola", testId('hola')),
          dom(
            'div',
            'Non-selectable (no role)',
            {tabindex: '-1', class: cssMenuItem.className},
            dom.on('click', (_, elem) => isSelectable(elem) && lastAction.set('Non-selectable (no role)'))
          ),
          menuItem(() => {}, 'Goodbye', dom.attr('aria-disabled', 'true')),
          menuItem(() => lastAction.set("Bonjour"), "Bonjour", testId('bonjour')),
        ]),
      ),
      cssButton('My Menu with grouped items',
        {tabindex: '0'},
        testId('btn-grouped-items'),
        menu(() => [
          testId('grouped-items-menu'),
          menuItem(() => lastAction.set('Ungrouped item click'), 'Ungrouped item', testId('ungrouped-item')),
          menuGroup('Grouped items header',
            menuItem(() => lastAction.set('Grouped item click 1'), 'Grouped item 1', testId('grouped-item1')),
            menuItem(() => lastAction.set('Grouped item click 2'), 'Grouped item 2', testId('grouped-item2')),
            menuItemSubmenu(makePasteSubmenu, {}, 'Grouped submenu', testId('grouped-sub-item')),
          ),
          menuGroup('Grouped items header 2',
            menuItem(() => lastAction.set('Grouped item click 2.1'), 'Grouped item 2.1'),
            menuItemLink({href: 'https://getgrist.com'}, 'Grouped item link 2.2', {"aria-disabled": "true"}),
            makeCheckboxItem('Grouped checkbox 2.3'),
            menuItem(() => {}, 'Grouped item 2.4', dom.attr('aria-disabled', 'true')),
            menuItem(() => lastAction.set('Grouped item click 2.5'), 'Grouped item 2.5'),
          ),
        ]),
      ),
    ),
    makeSelect(),
    makeComplexSelect({buttonTestId: 'btn4', list: employees, defaultValue: 0}),
    // Now we test if it works with a disabled item as the current value.
    makeComplexSelect({buttonTestId: 'btn4b', list: languages, defaultValue: 'fr'}),
    cssInputContainer(
      cssInput(inputObs, {onInput: true}, {placeholder: 'My Input Menu'},
        inputMenu(makeInputMenu, {trigger: [inputTrigger], attach: null, menuCssClass: cssInputMenu.className}),
        dom.onKeyPress({Enter: submitInput}),
        testId('input1')
      )
    ),
    cssInputContainer(
      makeAutocomplete(),
      dom('span', {style: 'font-size: 8pt'}, ' (Default behavior)')
    ),
    cssInputContainer(
      makeComplexAutocomplete(),
      dom('span', {style: 'font-size: 8pt'}, ' (Case-sensitive & custom select behavior)')
    ),
    dom('div', 'Last action: ',
      dom('span', dom.text(lastAction), testId('last'))
    ),
    resetBtn = cssResetButton('Reset',
      dom.on('click', () => lastAction.set('')), testId('reset')
    ),
    cssResetButton('Toggle expand icon', dom.on('click', () => {
      const css = cssOverride.className;
      if (document.body.classList.contains(css)) {
        document.body.classList.remove(css);
      } else {
        document.body.classList.add(css);
      }
    })),
  );
}

function makeMenu(ctl: IOpenController): DomElementArg[] {
  const hideCut = observable(false);
  const pasteList = obsArray(['Paste 1']);

  // Set a custom css class while menu is open.
  ctl.setOpenClass(document.body, 'custom-menu-open');

  console.log("makeMenu");
  return [
    testId('menu1'),
    menuItem(() => lastAction.set("Cut"), "Cut", dom.hide(hideCut), testId('cut')),
    menuItem(() => lastAction.set("Copy"), "Copy", testId('copy')),
    menuItem(() => lastAction.set("Disabled (should not happen!)"),
      dom.cls('disabled'), "Disabled", testId('disabled1')
    ),
    menuItem(() => {
      lastAction.set("Paste");
      pasteList.push(`Paste ${pasteList.get().length + 1}`);
    }, "Paste", testId('paste')),
    cssMenuDivider(testId('divider1')),
    dom.forEach(pasteList, (str) =>
      menuItem(() => lastAction.set(str), str)
    ),
    cssMenuDivider(testId('divider2')),
    menuItemLink({href: 'https://getgrist.com'}, 'Visit getgrist.com', testId('link1')),
    menuItem(() => {
      hideCut.set(!hideCut.get());
      lastAction.set("Show/Hide Cut");
    }, dom.text((use) => use(hideCut) ? "Show Cut" : "Hide Cut")),
    menuItem(() => resetBtn.focus(), 'Focus Reset', testId('focus-reset')),
    menuItem((elem) => popupOpen(elem, buildPopupContent, {
      placement: 'right',
    }), "popup", testId('popup-open')
    ),
    cssMenuDivider(),
    menuItemSubmenu(makePasteSubmenu, {
      expandIcon: () => dom('div', '->'),
      action: () => console.log("Paste Special clicked"),
    }, "Paste Special", testId('sub-item')),
  ];
}

function makePasteSubmenu(): DomElementArg[] {
  console.log("makePasteSubmenu");
  return [
    testId('submenu1'),
    menuItem(() => lastAction.set('Disabled (should not happen!)'), "Disabled",
      {class: 'disabled'}, testId('disabled2')),
    menuItem(() => lastAction.set('Cut2'), "Cut2", testId('cut2')),
    menuItem(() => lastAction.set('Copy2'), "Copy2", testId('copy2')),
    menuItem(() => lastAction.set('Paste2'), "Paste2", testId('paste2')),
    makeCheckboxItem('Checkbox test', testId('sub-item-checkbox')),
    menuItemSubmenu(makePasteSubmenu, {}, "Paste Special2", testId('sub-item2')),
    menuItemSubmenu(makePasteSubmenu, {}, "Paste Special2 with really long text", testId('sub-item2b')),
  ];
}

function makeFunkyMenu(): DomElementArg[] {
  console.log("makeFunkyMenu");
  return [
    testId('funky-menu'),
    menuItem(() => { console.log("Menu item: Cut"); }, "Cut"),
    menuItemSubmenu(makeFunkySubmenu, funkyOptions, "Paste Special"),
    menuItem(() => { console.log("Menu item: Copy"); }, "Copy"),
    cssMenuDivider(),
    menuItem(() => { console.log("Menu item: Paste"); }, "Paste"),
    menuItem(() => { disableSelect.set(!disableSelect.get()); }, "Toggle select disabled"),
    menuItem(() => {
      if (employees.get().length > 0) {
        employees.set(employees.get().slice(1));
      }
    }, "Remove employee")
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

function makeSelect() {
  console.log("makeSelect");
  const fruit = observable("avocado");
  const fruits = ["apple", "apricot", "avocado", "banana", "kiwi", "mango"];
  const btnElem = dom('div', testId('btn3'));
  const menuCssClass = dom('div', testId('select-dropdown')).className;
  return dom('div', { style: `width: 200px;` },
    select(fruit, fruits, {
      buttonCssClass: btnElem.className,
      menuCssClass,
      modifyContent: () => ({'data-modify-content-attr': 'select'})
    })
  );
}

function makeComplexSelect({buttonTestId, list, defaultValue}: {buttonTestId: string, list: MaybeObsArray<IOption<any>>, defaultValue: any}) {
  console.log("makeComplexSelect");
  const value = observable(defaultValue);
  const btnElem = cssSelectBtn(testId(buttonTestId));
  const menuCssClass = dom('div', testId('select-dropdown')).className;
  return select(value, list, {
    defaultLabel: "Employee:",
    menuCssClass: cssSelectMenu.className + ' ' + menuCssClass,
    buttonCssClass: btnElem.className,
    buttonArrow: dom('div', {style: `margin: 0 5px;`}, 'v'),
    disabled: disableSelect
  });
}

function makeInputMenu(): DomElementArg[] {
  console.log("makeInputMenu");
  return [
    testId('input1-menu'),
    menuItem(() => { console.log(`Menu item: ${inputObs.get()}`); },
      dom.text((use) => `Log "${use(inputObs)}"`),
      testId('input1-menu-item')
    )
  ];
}

function makeAutocomplete(): HTMLInputElement {
  console.log("makeAutocomplete");
  const inputVal = observable('');
  const employees = ['Thomas', 'June', 'Bethany', 'Mark', 'Marjorey', 'Zachary'];
  const inputElem = input(inputVal, {onInput: true}, {style: 'width: 200px;'},
    testId('autocomplete1')
  );
  return autocomplete(inputElem, employees, {menuCssClass: 'test-menu-autocomplete1'});
}

function makeComplexAutocomplete(): HTMLInputElement {
  console.log("makeComplexAutocomplete");
  const inputVal = observable('');
  const employees = ['Thomas', 'June', 'Bethany', 'Mark', 'Marjorey', 'Zachary'];
  const inputElem = input(inputVal, {onInput: true}, {style: 'width: 200px;'},
    testId('autocomplete2')
  );
  return autocomplete(inputElem, employees, {
    // Make matching case-sensistive
    findMatch: (content: HTMLElement[], val: string) => {
      return content.find((el: any) => el.textContent.startsWith(val)) || null;
    }
  });
}

function makeCheckboxItem(label: string, ...args: DomElementArg[]) {
  const checkboxObs = observable(false);
  return menuItemCheckbox(checkboxObs,
    // Note: a label is not required at all semantically since we are in a menu,
    // but we want to test behavior when a label is used.
    dom('label',
      dom('span', label),
      dom('span', dom('input',
        {
          type: 'checkbox',
          value: 'test',
        },
        dom.prop("checked", checkboxObs),
      ))
    ),
    ...args,
  );
}

function buildPopupContent(ctl: IOpenController): HTMLElement {
  return cssPopupContent(
    "Hello World",
    cssButton(
      'Ok', dom.on('click', () => ctl.close()),
      testId('popup-close')
    ),
    testId('popup')
  );
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
  width: 500px;
  padding: 16px;

  & button {
    display: block;
    white-space: nowrap;
  }
  &.weasel-popup-open {
    outline: 1px solid red;
  }
`);

const cssButtonsContainer = styled('div', `
  display: flex;
  gap: 8px;
  margin: 16px 0;
  flex-wrap: wrap;
  align-items: flex-start;
`);

const cssButton = styled('div', `
  width: 100px;
  font-size: 13px;
  border-radius: 3px;
  background-color: #4444aa;
  color: white;
  padding: 8px;
  &:hover, &.weasel-popup-open {
    background-color: #6666cc;
  }
`);

const cssResetButton = styled('button', `
  &:focus {
    outline: 3px solid yellow;
  }
`);

const cssFunkyMenu = styled('div', `
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

const cssSelectBtn = styled('div', `
  width: 130px;
  height: auto;
  line-height: 1;
  margin: 16px 0;
  display: flex !important;
`);

const cssSelectMenu = styled('div', `
  line-height: initial;
  padding: 16px 0px;
  box-shadow: 0 2px 20px 0 rgba(38,38,51,0.2);
  min-width: 160px;
  max-height: 400px;
  z-index: 999;
  overflow-y: scroll;
  max-height: 95vh;
  --weaseljs-menu-item-padding: 8px 16px;
`);

const cssInputContainer = styled('div', `
  position: relative;
  width: 400px;
  margin: 5px 0;
`);

const cssInput = styled(input, `
  width: 100%;
  height: 20px;
  margin: 0 0 16px 0;
`);

const cssInputMenu = styled('div', `
  min-width: 100%;
  z-index: 9999;
`);

const funkyOptions = {
  menuCssClass: cssFunkyMenu.className,
};

const cssPopupContent = styled('div', `
  background-color: darkCyan;
`);

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('main')!.appendChild(setupTest());
});

const cssOverride = styled('div', `
  & .weasel-popup-expand-icon {
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;
    -webkit-mask-size: contain;
    -webkit-mask-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTgsOS4xNzQ2MzA1MiBMMTAuOTIxODI3Myw2LjE4OTAyMzIgQzExLjE2ODQ3NDIsNS45MzY5OTIyNyAxMS41NjgzNjc5LDUuOTM2OTkyMjcgMTEuODE1MDE0OCw2LjE4OTAyMzIgQzEyLjA2MTY2MTcsNi40NDEwNTQxMyAxMi4wNjE2NjE3LDYuODQ5Njc3MDEgMTEuODE1MDE0OCw3LjEwMTcwNzk0IEw4LDExIEw0LjE4NDk4NTE5LDcuMTAxNzA3OTQgQzMuOTM4MzM4MjcsNi44NDk2NzcwMSAzLjkzODMzODI3LDYuNDQxMDU0MTMgNC4xODQ5ODUxOSw2LjE4OTAyMzIgQzQuNDMxNjMyMTEsNS45MzY5OTIyNyA0LjgzMTUyNTc4LDUuOTM2OTkyMjcgNS4wNzgxNzI3LDYuMTg5MDIzMiBMOCw5LjE3NDYzMDUyIFoiIGZpbGw9IiMwMDAiIGZpbGwtcnVsZT0ibm9uemVybyIgdHJhbnNmb3JtPSJyb3RhdGUoLTkwIDggOC41KSIvPjwvc3ZnPg==');
    background-color: black;
  }
  & .weasel-popup-expand-icon:after {
    content: '';
  }
`);
