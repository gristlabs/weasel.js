/**
 * A menu is a collection of menu items. Besides holding the items, it also knows which item is
 * selected, and allows selection via the keyboard.
 *
 * The standard menu item offers enough flexibility to suffice for many needs, and may be replaced
 * entirely by a custom item. For an item to be a selectable menu item, it needs `tabindex=-1`
 * attribute set. If unset, or if the "disabled" class is set, the item will not be selectable.
 *
 * Further, if `dom.data('menuItemSelected', (yesNo: boolean) => {})` is set, that callback will be
 * called whenever the item is selected and unselected. It may call onMenuItemSelected(yesNo) to keep
 * the default behavior of getting the suitable css class. A callback should be seldom needed, but it
 * is needed for nested menus.
 *
 * Clicks on items will normally propagate to the menu, where they get caught and close the menu.
 * If a click on an item should not close the menu, the item should stop the click's propagation.
 */
import {dom, domDispose, DomElementArg, DomElementMethod, styled} from 'grainjs';
import {Disposable, Observable, observable, onKeyDown} from 'grainjs';
import defaultsDeep = require('lodash/defaultsDeep');
import {IPopupContent, IPopupOptions, PopupControl, setPopupToFunc} from './popup';

export type MenuCreateFunc = (ctl: PopupControl) => DomElementArg[];

export interface IMenuOptions extends IPopupOptions {
  startIndex?: number;
  isSubMenu?: boolean;
  menuCssClass?: string;    // If provided, applies the css class to the menu container.
}

export interface ISubMenuOptions {
  menuCssClass?: string;    // If provided, applies the css class to the menu container.
}

/**
 * Attaches a menu to its trigger element, for example:
 *    dom('div', 'Open menu', menu((ctl) => [
 *      menuItem(...),
 *      menuItem(...),
 *    ]))
 */
export function menu(createFunc: MenuCreateFunc, options?: IMenuOptions): DomElementMethod {
  return (elem) => menuElem(elem, createFunc, options);
}
export function menuElem(triggerElem: Element, createFunc: MenuCreateFunc, options: IMenuOptions = {}) {
  options = defaultsDeep({}, options, defaultMenuOptions);
  setPopupToFunc(triggerElem,
    (ctl, opts) => Menu.create(null, ctl, createFunc(ctl), defaultsDeep(opts, options)),
    options);
}

/**
 * Implements a single menu item.
 * TODO: support various useful options. For example, Grist's SelectMenu provides the following,
 * and also a SelectMenu.SEPARATOR element.
 *    interface SelectMenuItem {
 *       name: string;             // The name to show
 *       action?: () => void;      // If present, call this when the (non-disabled) item is clicked
 *       disabled?: boolean | () => boolean;   // When this item should be disabled
 *       show?: observable<boolean> | () => boolean;   // When to show this item
 *       hide?: observable<boolean> | () => boolean;   // When to hide this item
 *       icon?: Element;           // Icon to display to the left of the name
 *       shortcut?: Element;       // Representation of the shortcut key, right-aligned
 *       href?: string;            // If present, item will be a link with this "href" attr
 *       download?: string;        // with href set, "download" attr (file name) for the link
 *    }
 *
 * The appearance of the menuItem components can be changed by setting the followingcss variables
 * in the parent project:
 *    --weaseljs-selected-background-color
 *    --weaseljs-selected-color
 *    --weaseljs-menu-item-padding
 */
export function menuItem(action: () => void, ...args: DomElementArg[]): Element {
  return cssMenuItem(
    ...args,
    dom.on('click', (ev, elem) => elem.classList.contains('disabled') || action()),
    onKeyDown({Enter$: action})
  );
}

export function onMenuItemSelected(yesNo: boolean, elem: Element) {
  if (yesNo) { (elem as HTMLElement).focus(); }
  elem.classList.toggle(cssMenuItem.className + '-sel', yesNo);
}

const defaultMenuOptions: IMenuOptions = {
  attach: 'body',
  boundaries: 'viewport',
  placement: 'bottom-start',
  showDelay: 0,
  trigger: ['click'],
};

/**
 * Implementation of the Menu. See menu() documentation for usage.
 */
export class Menu extends Disposable implements IPopupContent {
  public readonly content: Element;

  private _selected: Observable<Element|null> = observable(null);

  constructor(ctl: PopupControl, items: DomElementArg[], options: IMenuOptions = {}) {
    super();

    // When the selected element changes, update the classes of the formerly and newly-selected
    // elements and call any callbacks bound to selection stored on the elements.
    // Also focus the newly-selected element for keyboard events.
    this.autoDispose(this._selected.addListener((val: Element|null, prev: Element|null) => {
      if (val) {
        const callback = dom.getData(val, 'menuItemSelected') || onMenuItemSelected;
        callback(true, val);
      }
      if (prev) {
        const callback = dom.getData(prev, 'menuItemSelected') || onMenuItemSelected;
        callback(false, prev);
      }
    }));

    this.content = cssMenu({class: options.menuCssClass || ''},
      items,
      dom.on('mouseover', (ev) => this._onMouseOver(ev as MouseEvent)),
      dom.on('click', (ev) => this._findTargetItem(ev as MouseEvent) && ctl.close(0)),
      onKeyDown({
        ArrowDown: () => this._nextIndex(),
        ArrowUp: () => this._prevIndex(),
        ... options.isSubMenu ? {
          ArrowLeft: () => ctl.close(0),
        } : {
          Escape: () => ctl.close(0),
          Enter: () => ctl.close(0),    // gets bubbled key after action is taken.
        }
      }),
    );
    this.onDispose(() => domDispose(this.content));

    if (options.startIndex !== undefined) {
      // Not using isSelectable because it checks the offset height of the elements to determine
      // visibility. None of the elements have an offset height on creation since they are not yet
      // attached to the dom.
      const elems = Array.from(this.content.children).filter((elem) =>
        elem.hasAttribute('tabIndex') && !elem.classList.contains('disabled'));
      if (elems.length > options.startIndex) {
        this._selected.set(elems[options.startIndex]);
      }
    }

    FocusLayer.create(this, this.content);
  }

  private _nextIndex(): void {
    const elem = this._selected.get();
    const content = this.content;
    const getNext = (_elem: Element|null) =>
      (_elem && _elem.nextElementSibling) || content.firstElementChild;
    const next = getNextSelectable(elem, getNext);
    if (next) { this._selected.set(next); }
  }

  private _prevIndex(): void {
    const elem = this._selected.get();
    const content = this.content;
    const getNext = (_elem: Element|null) =>
      (_elem && _elem.previousElementSibling) || content.lastElementChild;
    const next = getNextSelectable(elem, getNext);
    if (next) { this._selected.set(next); }
  }

  private _onMouseOver(ev: MouseEvent) {
    // Find immediate child of this.content which is an ancestor of ev.target.
    const elem = this._findTargetItem(ev);
    if (elem) { this._selected.set(elem); }
  }

  private _findTargetItem(ev: MouseEvent): Element|null {
    const elem = findAncestorChild(this.content, ev.target as Element);
    return elem && isSelectable(elem) && !elem.classList.contains(cssMenu.className) ? elem : null;
  }
}

/**
 * Given a starting Element and a function to retrieve the next Element, returns the next selectable
 * Element (based on isSelectable). Returns null if the function to retrieve the next Element returns
 * null. Always returns startElem if returned by getNext function, to prevent an infinite loop.
 */
function getNextSelectable(startElem: Element|null, getNext: (elem: Element|null) => Element|null): Element|null {
  let next = getNext(startElem);
  while (next && next !== startElem && !isSelectable(next)) { next = getNext(next); }
  return next;
}

/**
 * Returns a boolean indicating whether the Element is selectable in the menu.
 */
function isSelectable(elem: Element): boolean {
  // Offset height > 0 is used to determine if the element is visible.
  return elem.hasAttribute('tabIndex') && !elem.classList.contains('disabled') &&
    (elem as HTMLElement).offsetHeight > 0;
}

/**
 * Helper function which returns the direct child of ancestor which is an ancestor of elem, or
 * null if elem is not a descendant of ancestor.
 */
function findAncestorChild(ancestor: Element, elem: Element|null): Element|null {
  while (elem && elem.parentNode !== ancestor) {
    elem = elem.parentElement;
  }
  return elem;
}

/**
 * Implements a menu item which opens a submenu.
 */
export function menuItemSubmenu(
  submenu: MenuCreateFunc,
  options: ISubMenuOptions,
  ...args: DomElementArg[]
): Element {
  const ctl: PopupControl<IMenuOptions> = PopupControl.create(null);

  const popupOptions: IMenuOptions = {
    placement: 'right-start',
    trigger: ['click'],
    modifiers: {preventOverflow: {padding: 10}},
    boundaries: 'viewport',
    controller: ctl,
    attach: null,
    isSubMenu: true,
    ...options
  };

  return cssMenuItem(...args,
    dom('div', '\u25B6'),     // A right-pointing triangle

    dom.autoDispose(ctl),

    // Set the submenu to be attached as a child of this element rather than as a sibling.
    menu(submenu, popupOptions),

    // On mouseover, open the submenu. Add a delay to avoid it on transient mouseovers.
    dom.on('mouseover', () => ctl.open({showDelay: 250})),

    // On right-arrow, open the submenu immediately, and select the first item automatically.
    onKeyDown({
      ArrowRight: () => ctl.open({startIndex: 0}),
      Enter: () => ctl.open({startIndex: 0}),
    }),

    // When selection changes, use default behavior and also close the popup.
    (elem: Element) => dom.dataElem(elem, 'menuItemSelected', (yesNo: boolean) => {
      onMenuItemSelected(yesNo, elem);
      return yesNo || ctl.close();
    }),

    // Clicks that open a submenu should not cause parent menu to close.
    dom.on('click', (ev) => { ev.stopPropagation(); }),
  );
}

export const cssMenu = styled('ul', `
  position: absolute;
  outline: none;
  list-style: none;
  margin: 2px;
  text-align: left;
  font-size: 13px;
  font-family: sans-serif;
  background-color: white;
  color: #1D1729;
  min-width: 160px;
  border: none;
  border-radius: 2px;
  box-shadow: 0 0 2px rgba(0,0,0,0.5);
  padding: 6px 0;
`);

export const cssMenuItem = styled('li', `
  display: flex;
  justify-content: space-between;
  outline: none;
  padding: var(--weaseljs-menu-item-padding, 8px 24px);

  &-sel {
    cursor: pointer;
    background-color: var(--weaseljs-selected-background-color, #5AC09C);
    color:            var(--weaseljs-selected-color, white);
  }
`);

export const cssMenuDivider = styled('div', `
  height: 1px;
  width: 100%;
  margin: 4px 0;
  background-color: #D9D9D9;
`);

// ----------------------------------------------------------------------

class FocusLayer extends Disposable {
  constructor(content: Element) {
    super();
    const previous: Element|null = document.activeElement;
    if (previous) {
      this.onDispose(() => (previous as HTMLElement).focus());
    }
    setTimeout(() => (content as HTMLElement).focus(), 0);
  }
}
