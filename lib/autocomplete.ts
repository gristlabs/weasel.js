import {dom, DomElementArg, MaybeObsArray, onElem, onKeyElem} from 'grainjs';
import {BaseMenu, defaultMenuOptions, IMenuOptions, menuItem} from './menu';
import {IOpenController, IPopupContent, PopupControl, setPopupToFunc} from './popup';

/**
 * IAutocomplete options adds two properties IMenuOptions to customize autocomplete behavior:
 */
export interface IAutocompleteOptions extends IMenuOptions {

  // Overrides default case-insensitive row select behavior.
  findMatch?: (content: HTMLElement[], value: string) => HTMLElement|null;

  // If true, the value is updated when a choice is selected (ie: by mouse over or arrow
  // navigation).
  updateOnSelect?: boolean;

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

  // Keeps track of the last value as typed by the user.
  let lastAsTyped = inputElem.value;
  const lis = dom.onElem(inputElem, 'input', () => lastAsTyped = inputElem.value);

  const contentFunc = () => [
    dom.autoDispose(lis),
    dom.forEach(choices, (opt) => (
      menuItem(
        () => { inputElem.value = opt; if (options.onClick) { options.onClick(opt); }},
        opt,
        dom.data('choice', opt),
        options.updateOnSelect ?
          dom.data('menuItemSelected', () => (yesNo: boolean) => inputElem.value = (yesNo ? opt : lastAsTyped)) :
          null,
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

  constructor(ctl: IOpenController, items: DomElementArg[], options: IAutocompleteOptions) {
    super(ctl, items, options);
    this.focusOnSelected = false;

    this._findMatch = options.findMatch || defaultFindMatch;

    const trigger = ctl.getTriggerElem() as HTMLInputElement;

    // Add key handlers to the trigger element as well as the menu if it is an input.
    this.autoDispose(onKeyElem(trigger, 'keydown', {
      ArrowDown: () => this.nextIndex(),
      ArrowUp: () => this.prevIndex(),
      // On Enter key we only update the value and let the event propagate for the consumer to
      // handle it directly.
      Enter$: () => this._selected && (trigger.value = dom.getData(this._selected, 'choice')),
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
}
