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
import {dom, domDispose, DomElementArg, DomElementMethod, DomMethod, EventCB, styled} from 'grainjs';
import {Disposable, onKeyDown, onKeyElem} from 'grainjs';
import defaultsDeep = require('lodash/defaultsDeep');
import mergeWith = require('lodash/mergeWith');
import {IOpenController, IPopupContent, IPopupOptions, PopupControl, setPopupToFunc} from './popup';
import {ISelectOptions} from './select';

export type MenuCreateFunc = (ctl: IOpenController) => DomElementArg[];

type MenuClassCons = (context: any, ctl: IOpenController, items: DomElementArg[], options?: IMenuOptions) => BaseMenu;

export interface IMenuOptions extends IPopupOptions {
  isSubMenu?: boolean;
  selectOnOpen?: boolean;
  menuCssClass?: string;    // If provided, applies the css class to the menu container.

  // If given, the menu will set the `weasel-popup-open` css class on the matching ancestor of the
  // trigger element (in addition to setting it on the trigger element itself). Useful to keep an
  // element highlighted while an associated menu is open.
  parentSelectorToMark?: string;

  // If given, sets the width of the opened menu to equal that of the matching ancestor of the
  // trigger element.
  stretchToSelector?: string;
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
  return baseElem((...args) => Menu.create(...args), triggerElem, createFunc, options);
}

/**
 * Attaches an inputMenu to its trigger element, for example:
 *    dom('input', select((ctl) => [
 *      menuItem(...),
 *      menuItem(...),
 *    ]))
 * The inputMenu menu differs from a normal menu in that focus is maintained on the triggerElem
 * when the menu is open. This makes it ideal for input trigger elements.
 */
export function inputMenu(createFunc: MenuCreateFunc, options?: IMenuOptions): DomElementMethod {
  return (elem) => inputMenuElem(elem, createFunc, options);
}
export function inputMenuElem(triggerElem: Element, createFunc: MenuCreateFunc, options: IMenuOptions = {}) {
  return baseElem((...args) => InputMenu.create(...args), triggerElem, createFunc, options);
}

// Helper for menuElem and selectElem.
function baseElem(createFn: MenuClassCons, triggerElem: Element, createFunc: MenuCreateFunc,
                  options: ISelectOptions = {}) {
  // This is similar to defaultsDeep but avoids merging arrays, since options.trigger should have
  // the exact value from options if present.
  options = mergeWith({}, defaultMenuOptions, options,
    (objValue: any, srcValue: any) => Array.isArray(srcValue) ? srcValue : undefined);
  setPopupToFunc(triggerElem,
    (ctl, opts) => createFn(null, ctl, createFunc(ctl), defaultsDeep(opts, options)),
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

export const defaultMenuOptions: IMenuOptions = {
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
 * Implementation of the BaseMenu. Extended by Menu and Select.
 */
export class BaseMenu extends Disposable implements IPopupContent {
  // The outer element (required by IPopupContent), which contains _menuContent.
  public readonly content: HTMLElement;

  // The UL element containing the actual menu items.
  protected _menuContent: HTMLElement;

  private _selected: HTMLElement|null = null;

  constructor(private ctl: IOpenController, items: DomElementArg[], options: IMenuOptions = {}) {
    super();
    const stretchContainer: Element|null = options.stretchToSelector ?
      ctl.getTriggerElem().closest(options.stretchToSelector) : null;

    // Set `weasel-popup-open` class on the ancestor of trigger that matches parentSelectorToMark.
    if (options && options.parentSelectorToMark) {
      const parent = ctl.getTriggerElem().closest(options.parentSelectorToMark);
      if (parent) {
        ctl.setOpenClass(parent);
      }
    }

    this.content = cssMenuWrap(
      this._menuContent = cssMenu({class: options.menuCssClass || ''},
        items,
        stretchContainer ? (elem) => stretchMenuToContainer(elem, stretchContainer) : null,
        mouseOverOnMove((ev) => this._onMouseOver(ev)),
        dom.on('mouseleave', (ev) => this._onMouseLeave(ev)),
        onKeyDown({
          ArrowDown: () => this.nextIndex(),
          ArrowUp: () => this.prevIndex(),
          ...options.isSubMenu ? {
            ArrowLeft: () => ctl.close(0),
          } : {},
        }),
      ),
      // Events set on the parent of _menuContent receive events bubbled up from submenus.
      dom.on('click', (ev) => isInSelectableItem(ev.target as Element) ? ctl.close(0) : ev.stopPropagation()),
      options.isSubMenu ? null :
        onKeyDown({
          Escape: () => ctl.close(0),
          Enter: () => ctl.close(0),    // gets bubbled key after action is taken.
        }),
    );
    this.onDispose(() => domDispose(this.content));
  }

  public onRemove() {
    // The focus restoration is mainly needed for the sake of submenus. When focus has already
    // moved elsewhere, don't restore it. We need to check it before the menu is removed from DOM.
    if (this.content.contains(document.activeElement)) {
      (this.ctl.getTriggerElem() as HTMLElement).focus();
    }
  }

  protected nextIndex(): void {
    const next = getNextSelectable(this._selected,
      (elem) => (elem && elem.nextElementSibling) || this._menuContent.firstElementChild);
    if (next) { this.setSelected(next); }
  }

  protected prevIndex(): void {
    const next = getNextSelectable(this._selected,
      (elem) => (elem && elem.previousElementSibling) || this._menuContent.lastElementChild);
    if (next) { this.setSelected(next); }
  }

  // When the selected element changes, update the classes of the formerly and newly-selected
  // elements and call any callbacks bound to selection stored on the elements.
  // Also focus the newly-selected element for keyboard events.
  protected setSelected(elem: HTMLElement|null) {
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
    (elem || this._menuContent).focus();
  }

  private _onMouseOver(ev: MouseEvent) {
    if (!isMenuContainer(ev.target as Element)) {
      const elem = this._findTargetItem(ev);
      this.setSelected(elem);     // If elem is null, intentionally deselect.
    }
  }

  private _onMouseLeave(ev: MouseEvent) {
    const elem = this._selected;
    if (elem && !elem.classList.contains('weasel-popup-open')) {
      // Don't deselect if there is an open submenu.
      this.setSelected(null);
    }
  }

  private _findTargetItem(ev: MouseEvent): HTMLElement|null {
    // Find immediate child of this._menuContent which is an ancestor of ev.target.
    const elem = findAncestorChild(this._menuContent, ev.target as Element);
    return elem && isSelectable(elem) ? elem : null;
  }
}

/**
 * Implementation of the Menu. See menu() documentation for usage.
 */
export class Menu extends BaseMenu implements IPopupContent {
  constructor(ctl: IOpenController, items: DomElementArg[], options: IMenuOptions = {}) {
    super(ctl, items, options);

    setTimeout(() =>
      (options.selectOnOpen ? this.nextIndex() : this._menuContent.focus()), 0);
  }
}

/**
 * Implementation of the InputMenu. See inputMenu() documentation for usage.
 */
export class InputMenu extends BaseMenu implements IPopupContent {
  constructor(ctl: IOpenController, items: DomElementArg[], options: IMenuOptions = {}) {
    super(ctl, items, options);

    // Add key handlers to the trigger element as well as the menu if it is an input.
    this.autoDispose(onKeyElem(ctl.getTriggerElem() as HTMLElement, 'keydown', {
      ArrowDown: () => this.nextIndex(),
      ArrowUp: () => this.prevIndex(),
      Escape: () => ctl.close(0)
    }));
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
function getNextSelectable(startElem: Element|null,
                           getNext: (elem: Element|null) => Element|null): HTMLElement|null {
  let next = getNext(startElem);
  while (next && next !== startElem && !isSelectable(next)) { next = getNext(next); }
  return next as HTMLElement|null;
}

/**
 * Returns a boolean indicating whether the Element is selectable in the menu.
 */
function isSelectable(elem: Element): elem is HTMLElement {
  // Offset height > 0 is used to determine if the element is visible.
  return elem.hasAttribute('tabIndex') && !elem.classList.contains('disabled') &&
    (elem as HTMLElement).offsetHeight > 0;
}

/**
 * Whether the given element is part of a selectable item. A click on it will close menus.
 */
function isInSelectableItem(elem: Element): boolean {
  // Similar to _findTargetItem, but finds the menu item (direct child of cssMenu) containing
  // elem, regardless of which menu or submenu it's in, and returns whether it's selectable.
  const item = findAncestorChild(elem.closest('.' + cssMenu.className)!, elem);
  return item ? isSelectable(item) : false;
}

/**
 * Helper function which returns the direct child of ancestor which is an ancestor of elem, or
 * null if elem is not a descendant of ancestor.
 */
function findAncestorChild(ancestor: Element, elem: Element|null): Element|null {
  while (elem && elem.parentElement !== ancestor) {
    elem = elem.parentElement;
  }
  return elem;
}

/**
 * Sets the width of the given menu element to match the given container element. Used by
 * IMenuOptions setting 'stretchToSelector'.
 */
function stretchMenuToContainer(menuEl: HTMLElement, containerElem: Element): void {
  const style = menuEl.style;
  style.minWidth = containerElem.getBoundingClientRect().width + 'px';
  style.marginLeft = style.marginRight = '0';
}

/**
 * A version of dom.on('mouseover') that doesn't start firing until there is first a 'mousemove'.
 * This way if an element is created under the mouse cursor (triggered by the keyboard, for
 * instance) it's not immediately highlighted, but only when a user moves the mouse.
 */
function mouseOverOnMove<T extends EventTarget>(callback: EventCB<MouseEvent, T>): DomMethod<T> {
  return (elem) => {
    const lis = dom.onElem(elem, 'mousemove', (...args) => {
      lis.dispose();
      dom.onElem(elem, 'mouseover', callback);
      callback(...args);
    });
  };
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
    attach: '.' + cssMenuWrap.className,
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

export const cssMenuWrap = styled('div', `
  position: absolute;
  display: flex;
  flex-direction: column;
  outline: none;
`);

export const cssMenu = styled('ul', `
  max-height: calc(95vh - 10px);
  box-sizing: border-box;
  overflow: auto;
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
