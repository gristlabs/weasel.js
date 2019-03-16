/**
 * A menu is a collection of menu items. Besides holding the items, it also knows which item is
 * selected, and allows selection via the keyboard.
 *
 * The standard menu item offers enough flexibility to suffice for many needs, and may be replaced
 * entirely by a custom item. For an item to be a selectable menu item, it needs `tabindex=-1`
 * attribute set. If unset, or if the "disabled" class is set, the item will not be selectable.
 *
 * Further, if `dom.data('menuItemSelected', (yesNo: boolean, elem) => {})` is set, that callback
 * will be called whenever the item is selected and unselected. In addition, the selected item
 * gets a css class. A callback should be seldom needed, but it is use for nested menus.
 *
 * Clicks on items will normally propagate to the menu, where they get caught and close the menu.
 * If a click on an item should not close the menu, the item should stop the click's propagation.
 */
import {dom, domDispose, DomElementArg, DomElementMethod, styled} from 'grainjs';
import {Disposable, onKeyDown} from 'grainjs';
import defaultsDeep = require('lodash/defaultsDeep');
import mergeWith = require('lodash/mergeWith');
import {IOpenController, IPopupContent, IPopupOptions, PopupControl, setPopupToFunc} from './popup';

export type MenuCreateFunc = (ctl: IOpenController) => DomElementArg[];

export interface IMenuOptions extends IPopupOptions {
  isSubMenu?: boolean;
  selectOnOpen?: boolean;
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
  // This is similar to defaultsDeep but avoids merging arrays, since options.trigger should have
  // the exact value from options if present.
  options = mergeWith({}, defaultMenuOptions, options,
    (objValue: any, srcValue: any) => Array.isArray(srcValue) ? srcValue : undefined);
  setPopupToFunc(triggerElem,
    (ctl, opts) => Menu.create(null, ctl, createFunc(ctl), defaultsDeep(opts, options)),
    options);
}

/**
 * Implements a single menu item.
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

/**
 * A version of menuItem that's an <a> link element.
 */
export function menuItemLink(...args: DomElementArg[]): Element {
  return cssMenuItemLink({tabindex: '-1'}, cssMenuItem.cls(''), ...args,
    // This prevents propagation, but NOT the default action, which is to open the link.
    onKeyDown({Enter$: (ev) => ev.stopPropagation()})
  );
}

const defaultMenuOptions: IMenuOptions = {
  attach: 'body',
  boundaries: 'viewport',
  placement: 'bottom-start',
  showDelay: 0,
  trigger: ['click'],
  modifiers: {
    // gpuAcceleration (true by default) causes a tiny UI artifact: attempting to drag a link, at
    // least in Firefox, causes it to be dragged from a different location on the screen where it
    // actually is, which looks strange. Disabling has no noticeable downsides.
    computeStyle: {gpuAcceleration: false}
  },
};

/**
 * Implementation of the Menu. See menu() documentation for usage.
 */
export class Menu extends Disposable implements IPopupContent {
  public readonly content: Element;

  private _selected: Element|null = null;

  constructor(ctl: IOpenController, items: DomElementArg[], options: IMenuOptions = {}) {
    super();

    this.content = cssMenu({class: options.menuCssClass || ''},
      items,
      dom.on('mouseover', (ev) => this._onMouseOver(ev as MouseEvent)),
      dom.on('mouseleave', (ev) => this._onMouseLeave(ev as MouseEvent)),
      dom.on('click', (ev) => this._findTargetItem(ev as MouseEvent) ? ctl.close(0) : ev.stopPropagation()),
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

    setTimeout(() =>
      (options.selectOnOpen ? this._nextIndex() : (this.content as HTMLElement).focus()), 0);

    // The focus restoration is mainly needed for the sake of submenus.
    ctl.onDispose(() => (ctl.getTriggerElem() as HTMLElement).focus());
  }

  private _nextIndex(): void {
    const content = this.content;
    const getNext = (_elem: Element|null) =>
      (_elem && _elem.nextElementSibling) || content.firstElementChild;
    const next = getNextSelectable(this._selected, getNext);
    if (next) { this._setSelected(next); }
  }

  private _prevIndex(): void {
    const content = this.content;
    const getNext = (_elem: Element|null) =>
      (_elem && _elem.previousElementSibling) || content.lastElementChild;
    const next = getNextSelectable(this._selected, getNext);
    if (next) { this._setSelected(next); }
  }

  private _onMouseOver(ev: MouseEvent) {
    const elem = this._findTargetItem(ev);
    if (!isMenuContainer(elem)) {
      this._setSelected(elem);     // If elem is null, intentionally deselect.
    }
  }

  private _onMouseLeave(ev: MouseEvent) {
    const elem = this._selected;
    if (elem && !elem.classList.contains('weasel-popup-open')) {
      // Don't deselect if there is an open submenu.
      this._setSelected(null);
    }
  }

  private _findTargetItem(ev: MouseEvent): Element|null {
    // Find immediate child of this.content which is an ancestor of ev.target.
    const elem = findAncestorChild(this.content, ev.target as Element);
    return elem && isSelectable(elem) ? elem : null;
  }

  // When the selected element changes, update the classes of the formerly and newly-selected
  // elements and call any callbacks bound to selection stored on the elements.
  // Also focus the newly-selected element for keyboard events.
  private _setSelected(elem: Element|null) {
    const prev = this._selected;
    if (elem === prev) { return; }
    if (prev) {
      const callback = dom.getData(prev, 'menuItemSelected');
      if (callback) { callback(false, prev); }
      prev.classList.remove(cssMenuItem.className + '-sel');
    }
    if (elem) {
      const callback = dom.getData(elem, 'menuItemSelected');
      if (callback) { callback(true, elem); }
      elem.classList.add(cssMenuItem.className + '-sel');
    }
    this._selected = elem;
    // Focus the item if available, or the parent menu container otherwise.
    ((elem || this.content) as HTMLElement).focus();
  }
}

/**
 * Returns true if elem is a menu (or submenu) div.
 */
function isMenuContainer(elem: Element|null) {
  return elem && elem.classList.contains(cssMenu.className);
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
    trigger: [],    // no "click": don't toggle this menu on click.
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
    dom.on('mouseenter', () => ctl.open({showDelay: 200})),

    // On right-arrow, open the submenu immediately, and select the first item automatically.
    onKeyDown({
      ArrowRight: () => ctl.open({selectOnOpen: true}),
      Enter: () => ctl.open({selectOnOpen: true}),
    }),

    // When selection changes, use default behavior and also close the popup.
    (elem: Element) => dom.dataElem(elem, 'menuItemSelected',
      (yesNo: boolean) => yesNo || ctl.close()),

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
  &.disabled {
    color: grey;
  }
`);

export const cssMenuItemLink = styled('a', `
  display: flex;
  justify-content: space-between;
  outline: none;
  padding: var(--weaseljs-menu-item-padding, 8px 24px);
  user-select: none;
  -moz-user-select: none;

  &, &:hover, &:focus {
    color: inherit;
    text-decoration: none;
    outline: none;
  }
  &.${cssMenuItem.className}-sel {
    color: var(--weaseljs-selected-color, white);
  }
`);

export const cssMenuDivider = styled('div', `
  height: 1px;
  width: 100%;
  margin: 4px 0;
  background-color: #D9D9D9;
`);
