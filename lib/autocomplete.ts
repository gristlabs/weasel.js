import {dom, DomElementArg, MaybeObsArray, onElem, onKeyElem} from 'grainjs';
import {BaseMenu, defaultMenuOptions, IMenuOptions, menuItem} from './menu';
import {IOpenController, IPopupContent, PopupControl, setPopupToFunc} from './popup';

/**
 * IAutocomplete options adds some properties to IMenuOptions to customize autocomplete behavior:
 */
export interface IAutocompleteOptions extends IMenuOptions {

  // Overrides default case-insensitive row select behavior.
  findMatch?: (content: HTMLElement[], value: string) => HTMLElement|null;

  // A callback triggered when user clicks one of the choices.
  onClick?: (choice: string) => void;

}

const defaultFindMatch = (content: HTMLElement[], val: string) => {
  if (!val) { return null; } // Empty string match nothing
  val = val.toLowerCase();
  return content.find((el: any) => el.textContent.toLowerCase().startsWith(val)) || null;
};

/**
 * User interface for creating a weasel autocomplete element in DOM.
 *
 * Usage:
 *      const employees = ['Thomas', 'June', 'Bethany', 'Mark', 'Marjorey', 'Zachary'];
 *      const inputElem = input(...);
 *      autocomplete(inputElem, employees);
 */
export function autocomplete(
  inputElem: HTMLInputElement,
  choices: MaybeObsArray<string>,
  options: IAutocompleteOptions = {}
): HTMLInputElement {

  // Options to pass into the Autocomplete class.
  const menuOptions: IAutocompleteOptions = {
    ...defaultMenuOptions,
    trigger: [(triggerElem: Element, ctl: PopupControl) => {
      dom.onElem(triggerElem, 'focus', () => ctl.open());
      dom.onKeyElem(triggerElem as HTMLElement, 'keydown', {
        ArrowDown: () => ctl.open(),
        ArrowUp: () => ctl.open()
      });
    }],
    stretchToSelector: 'input, textarea',
    ...options
  };

  const contentFunc = () => [
    dom.forEach(choices, (opt) => (
      menuItem(
        () => { inputElem.value = opt; if (options.onClick) { options.onClick(opt); }},
        opt,
      )
    ))
  ];

  setPopupToFunc(inputElem,
    (ctl) => Autocomplete.create(null, ctl, contentFunc(), menuOptions),
    menuOptions);

  return inputElem;
}

/**
 * Creates an instance of Menu meant to be attached to an input and used as an autocomplete.
 *
 * Should always be created using autocomplete(), which accepts as an argument the input element.
 */
class Autocomplete extends BaseMenu implements IPopupContent {
  private readonly _rows: HTMLElement[] = Array.from(this._menuContent.children) as HTMLElement[];
  private readonly _findMatch: (content: HTMLElement[], value: string) => HTMLElement|null;
  private _lastAsTyped: string;

  constructor(ctl: IOpenController, items: DomElementArg[], options: IAutocompleteOptions) {
    super(ctl, items, options);
    this.focusOnSelected = false;

    this._findMatch = options.findMatch || defaultFindMatch;

    const trigger = ctl.getTriggerElem() as HTMLInputElement;

    // Keeps track of the last value as typed by the user.
    this._lastAsTyped = trigger.value;
    this.autoDispose(dom.onElem(trigger, 'input', () => { this._lastAsTyped = trigger.value; }));

    // Add key handlers to the trigger element as well as the menu if it is an input.
    this.autoDispose(onKeyElem(trigger, 'keydown', {
      ArrowDown: () => {
        this.nextIndex();
        this._updateValue(trigger);
      },
      ArrowUp: () => {
        this.prevIndex();
        this._updateValue(trigger);
      },
      // On Enter (and Tab) key, we update the trigger's value and close the dropdown. We always let
      // event propagate (notice the '$' at the end of 'Enter$') because the user may want to handle
      // these events independently as well. Note that the menu items' action does not run on Enter
      // because the focus remains on the trigger element at all time.
      Enter$: (ev) => {
        this._updateValue(trigger);
        ctl.close();
      },
      Tab$: (ev) => {
        this._updateValue(trigger);
        ctl.close();
      },
      Escape$: () => ctl.close(),
    }));

    this.autoDispose(onElem(trigger, 'input', () => {
      this._selectRow(trigger.value);
    }));

    if (trigger.value) {
      this._selectRow(trigger.value);
    }

    // Prevent trigger element from being blurred on click.
    dom.onElem(this._menuContent, 'mousedown', (ev) => ev.preventDefault());
  }

  private _selectRow(inputVal: string): void {
    const match: HTMLElement|null = this._findMatch(this._rows, inputVal);
    this.setSelected(match);
  }

  // Update trigger's value with the currently selected choice. Or with the last typed value, if
  // nothing is selected.
  private _updateValue(trigger: HTMLInputElement) {
    trigger.value = this._selected ? this._selected.textContent! : this._lastAsTyped;
  }
}
