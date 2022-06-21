import {dom, DomArg, DomElementArg, onElem, styled} from 'grainjs';
import {BindableValue, Computed, MaybeObsArray, Observable} from 'grainjs';
import {BaseMenu, defaultMenuOptions, IMenuOptions, menuItem} from './menu';
import {IOpenController, IPopupOptions, PopupControl, setPopupToFunc} from './popup';

export interface IOptionFull<T> {
  value: T;
  label: string;
  disabled?: boolean;
  // Note that additional properties may be used for storing per-row info such as icon names.
  // The additional property is accessible in each row's renderOption callback.
  [addl: string]: any;
};

// For string options, we can use a string for label and value without wrapping into an object.
export type IOption<T> = (T & string) | IOptionFull<T>;

export interface ISelectUserOptions {
  defaultLabel?: string,   // Button label displayed when no value is selected.
  buttonArrow?: DomArg,    // DOM for what is typically the chevron on the select button.
  menuCssClass?: string,   // If provided, applies the css class to the menu container.
  buttonCssClass?: string  // If provided, applies the css class to the select button.
  // If disabled, adds the .disabled class to the select button and prevents opening.
  disabled?: BindableValue<boolean>;
  attach?: IPopupOptions['attach'];
}

export interface ISelectOptions extends IMenuOptions {
  // Selects the items with the given label on open - intended for internal use.
  selectLabelOnOpen?: () => string;
}

/**
 * User interface for creating a weasel select element in DOM.
 *
 * Usage:
 *    const fruit = observable("apple");
 *    select(fruit, () => ["apple", "banana", "mango"]);
 *
 *    const employee = observable(17);
 *    const employeesCB = () => [
 *      {value: 12, label: "Bob", disabled: true},
 *      {value: 17, label: "Alice"},
 *      {value: 21, label: "Eve"},
 *    ];
 *    select(employee, employeesCB, {defaultLabel: "Select employee:"});
 *
 * NOTE that a MaybeObsArray is accepted for the select options. We do not accept a callback to be
 * called when the dropdown menu is opened, since the active options also determine what is
 * displayed as the selected value on the button when the dropdown menu is closed.
 */
export function select<T>(
  obs: Observable<T>,
  optionArray: MaybeObsArray<IOption<T>>,
  options: ISelectUserOptions = {},
  renderOption: (option: IOptionFull<T|null>) => DomArg = (option) => option.label
): Element {
  // Create SelectKeyState to manage user value search inputs.
  const keyState = new SelectKeyState<T>(optionArray);

  // Computed contains the IOptionFull of the obs value.
  const selected = Computed.create(null, obs, (use, val) => {
    const array = Array.isArray(optionArray) ? optionArray : use(optionArray);
    const option = array.find(_op => val === getOptionFull(_op).value);
    return option ? getOptionFull(option) : ({value: null, label: options.defaultLabel || ""} as IOptionFull<null>);
  });

  // Select button and associated event/disposal DOM.
  const selectBtn: Element = cssSelectBtn({tabIndex: '0', class: options.buttonCssClass || ''},
    dom.autoDispose(selected),
    options.disabled ? dom.cls('disabled', options.disabled) : null,
    cssBtnText(
      dom.domComputed(selected, sel => renderOption(sel))
    ),
    dom('div', {style: 'flex: none;'},
      options.buttonArrow
    ),
    dom.on('keydown', (ev) => {
      if (isDisabled()) { return; }
      const sel = keyState.add(ev.key);
      if (sel) { obs.set(sel.value); }
    })
  );

  // Options to pass into the Select class.
  const isDisabled = () => selectBtn.classList.contains('disabled');
  const selectOptions: ISelectOptions = {
    ...defaultMenuOptions,
    menuCssClass: options.menuCssClass,
    attach: options.attach === undefined ? defaultMenuOptions.attach : options.attach,
    trigger: [(triggerElem: Element, ctl: PopupControl) => {
      dom.onElem(triggerElem, 'click', () => isDisabled() || ctl.toggle()),
      dom.onKeyElem(triggerElem as HTMLElement, 'keydown', {
        ArrowDown: () => isDisabled() || ctl.open(),
        ArrowUp: () => isDisabled() || ctl.open()
      })
    }],
    selectLabelOnOpen: () => selected.get().label,
    stretchToSelector: `.${cssSelectBtn.className}`
  };

  // DOM content of the open select menu.
  const selectContent = () => [
    dom.forEach(optionArray, (option) => {
      const obj: IOptionFull<T> = getOptionFull(option);
      // Note we only set 'selected' when an <option> is created; we are not subscribing to obs.
      // This is to reduce the amount of subscriptions, esp. when number of options is large.
      return menuItem(() => { obs.set(obj.value); },
        Object.assign({disabled: obj.disabled, selected: obj.value === obs.get()},
          obj.disabled ? {class: 'disabled'} : {}),
        renderOption(obj)
      );
    })
  ];

  setPopupToFunc(selectBtn,
    (ctl) => Select.create(null, ctl, selectContent(), selectOptions),
    selectOptions);

  return selectBtn;
}

/**
 * Creates an instance of Menu intended to mimic the behavior of the select HTML element.
 *
 * Should always be created using select(), which adds the select button and associated logic.
 */
class Select<T> extends BaseMenu {
  private readonly _selectRows: HTMLElement[] = Array.from(this._menuContent.children) as HTMLElement[];

  // Create array of options on build to prevent rebuilding on each keystroke.
  private readonly _selectOptions: IOption<string>[] = this._selectRows.map(_elem => ({
    label: _elem.textContent || "",
    value: _elem.textContent || "",
    disabled: _elem.classList.contains('disabled')
  }));

  // The class Select handles key input separately from the function select() since the selected
  // option is not maintained in the class, so the search callback is called on each keystroke.
  private readonly _keyState: SelectKeyState<string> = new SelectKeyState(this._selectOptions);

  constructor(ctl: IOpenController, items: DomElementArg[], options: ISelectOptions = {}) {
    super(ctl, items, options);

    // On keydown, search for the first element with a matching label.
    onElem(this._menuContent, 'keydown', (ev) => {
      const sel = this._keyState.add(ev.key);
      if (sel) { this._selectRow(sel.label); }
    });

    // If an initial value is given, use it, otherwise select the first element.
    const init = options.selectLabelOnOpen ? options.selectLabelOnOpen() : "";
    setTimeout(() => this._selectRow(init, true), 0);
  }

  // If defaultToNext is set, the next index is selected when no element is found.
  private _selectRow(label: string, defaultToNext: boolean = false): void {
    const elem = this._selectRows.find(_elem => _elem.textContent === label);
    return (elem || !defaultToNext) ? this.setSelected(elem || null) : this.nextIndex();
  }
}


/**
 * Maintains the state of the user's keyed-in value when searching in the select element.
 */
class SelectKeyState<T> {
  private _term: string = "";
  private _cycleIndex: number = 0;
  private _timeoutId: NodeJS.Timeout|null = null;

  // Requires _itemCallback, a function that returns all IOptions in the select.
  constructor(private _itemArray: MaybeObsArray<IOption<T>>) {}

  // Adds a character to the search term. Returns the latest first match of the items, or null
  // if no items match.
  public add(char: string): IOptionFull<T>|null {
    // Filter out any keys that are not a single character. Make all searching case-insensitive.
    if (char.length > 1) { return null; }
    char = char.toLowerCase();

    // Clear the search term after a timeout. Any new entry should reset the timeout.
    if (this._timeoutId) { clearTimeout(this._timeoutId); }
    this._timeoutId = setTimeout(() => { this._term = ""; }, 1000);

    // Add character to the search term and look for a match. If a match is found, update the
    // observable value.
    if (this._term.length === 1 && char === this._term[0]) {
      // If the same character is pressed repeatedly, cycle through all options starting with
      // that character.
      this._cycleIndex += 1;
    } else {
      // Add character to the search term and reset the cycle search index.
      this._term += char;
      this._cycleIndex = 0;
    }
    const items = Array.isArray(this._itemArray) ? this._itemArray : this._itemArray.get();
    const matches = items.filter(_item => {
      _item = getOptionFull(_item);
      return !_item.disabled && _item.label.toLowerCase().startsWith(this._term);
    });
    if (matches.length > 0) {
      this._cycleIndex %= matches.length;
      return getOptionFull(matches[this._cycleIndex]);
    }
    return null;
  }
}

export function getOptionFull<T>(option: IOption<T>): IOptionFull<T> {
  return (typeof option === "string") ? {value: option, label: option} : (option as IOptionFull<T>);
}

// Prevents select button text overflow.
const cssBtnText = styled('div', `
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`);

const cssSelectBtn = styled('div', `
  position: relative;
  display: flex;
  justify-content: space-between;
  width: 100%;
  height: 30px;
  line-height: 30px;
  background-color: white;
  color: black;
  padding: 6px;
  border: 1px solid grey;
  border-radius: 3px;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  -webkit-appearance: none;
  -moz-appearance: none;
  user-select: none;
  -moz-user-select: none;

  &:focus {
    outline: none;
    box-shadow: 0px 0px 2px 2px #5E9ED6;
  }

  &.disabled {
    color: grey;
    cursor: pointer;
  }
`);
