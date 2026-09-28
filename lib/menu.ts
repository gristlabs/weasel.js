/**
 * A menu is a collection of menu items. Besides holding the items, it also knows which item is
 * selected, and allows selection via the keyboard.
 *
 * The standard menu item helpers (`menuItem` and `menuItemCheckbox`) offer enough flexibility to suffice for many needs,
 * and may be replaced entirely by custom items.
 * For an item to be a selectable menu item, it needs `tabindex=-1` attribute set, and a role of either
 * "menuitem", "menuitemcheckbox", or "option" (for selects).
 * If there is no tabindex or role, if "aria-disabled" is set to "true", or if the "disabled" class is set[1],
 * the item will not be selectable[2].
 *
 * [1] Using "aria-disabled" is preferred over the "disabled" class for compatibility
 * with assistive technologies.
 *
 * [2] A non-selectable custom item can still be clicked, so when building a custom menu item,
 * make sure to use the `isSelectable` helper in your click callback to decide if its action should be triggered.
 * Note that clicking non-selectable items don't close the menu.
 *
 * Further, if `dom.dataElem(elem, 'menuItemSelected', (yesNo: boolean, elem) => {})` is set, that
 * callback will be called whenever the item is selected and unselected. In addition, the selected
 * item gets a css class. A callback should be seldom needed, but it is use for nested menus.
 *
 * Clicks on items will normally propagate to the menu, where they get caught and close the menu.
 * If a click on an item should not close the menu, the item should stop the click's propagation.
 */
import {dom, domDispose, DomElementArg, DomElementMethod, DomMethod, EventCB, Observable, styled} from 'grainjs';
import {Disposable, onKeyDown, onKeyElem} from 'grainjs';
import defaultsDeep = require('lodash/defaultsDeep');
import mergeWith = require('lodash/mergeWith');
import uniqueId = require('lodash/uniqueId');
import {IOpenController, IPopupContent, IPopupOptions, PopupControl, setPopupToFunc} from './popup';
import {ISelectOptions} from './select';

export type MenuCreateFunc = (ctl: IOpenController) => DomElementArg[];

type MenuClassCons = (context: any, ctl: IOpenController, items: DomElementArg[], options?: IMenuOptions) => BaseMenu;

export interface IMenuOptions extends IPopupOptions {
  isSubMenu?: boolean;
  selectOnOpen?: boolean;
  menuCssClass?: string;    // If provided, applies the css class to the menu container.

  // If provided, applies the css class to the wrapper around the menu container. This is
  // recommended if you need to set the z-index on menus, since setting it on menuCssClass
  // sometimes leads to truncated submenus in Safari.
  // More on Safari issue https://ecomgraduates.com/blogs/news/fixing-z-index-issue-on-safari-browser.
  menuWrapCssClass?: string;

  // If given, the menu will set the `weasel-popup-open` css class on the matching ancestor of the
  // trigger element (in addition to setting it on the trigger element itself). Useful to keep an
  // element highlighted while an associated menu is open.
  parentSelectorToMark?: string;

  // If given, sets the width of the opened menu to equal that of the matching ancestor of the
  // trigger element.
  stretchToSelector?: string;

  // If set to true, users can move to nothing selected with arrow keys. Otherwise, pressing arrow
  // down on the last item selects the first one, and pressing the arrow up on the first item
  // selects the last one.
  allowNothingSelected?: boolean;

  // For specific use cases, you can modify the menu `ul` element the usual grainjs way,
  // and/or act on the tied weasel controller.
  //    modifyContent: (menuEl, ctl) => ({ "data-random-attribute": "random value" })
  //    modifyContent: (menuEl, ctl) => attachRandomThingToCtl(ctl)
  //    modifyContent: (menuEl, ctl) => [attachRandomThingToCtl(ctl), {"data-random": "value"}]
  modifyContent?: (menuEl: HTMLElement, ctl: IOpenController) => DomElementArg;
}

export interface ISubMenuOptions {
  menuCssClass?: string;    // If provided, applies the css class to the menu container.
  menuWrapCssClass?: string;  // See IMenupOptions.
  expandIcon?:  () => DomElementArg; // Overrides the default expand icon.
  action?: (item: HTMLElement, event: Event) => void; // If provided, called when the item is clicked.
}

const weaselIdPrefix = 'weasel-element-';

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

  const isInput = triggerElem.tagName.toLowerCase() === 'input';
  // We don't do anything for input menus as they require a different approach to work correctly with
  // screen readers (not implemented).
  if (!isInput) {
    if (!triggerElem.id) {
      triggerElem.id = uniqueId(weaselIdPrefix);
    }
    // The aria-expanded attr makes screen readers (SR) announce that the button is expandable, when focus is on it.
    // We don't want to announce that when the trigger is not a normal click/keypress, for example a contextmenu event.
    // Otherwise SR users might try to activate the button with Enter and get confused why it doesn't work.
    const useExpandedAttr = options.trigger?.some(t =>
      t === "click" || (typeof t === 'object' && t.keys?.includes('Enter'))
    );
    if (useExpandedAttr) {
      triggerElem.setAttribute('aria-expanded', 'false');
    }
  }

  setPopupToFunc(triggerElem,
    (ctl, opts) => createFn(null, ctl, createFunc(ctl), defaultsDeep(opts, options)),
    options);
}

/**
 * Implements a single menu item.
 *
 * The item is generated with tabindex="-1". To generate a menu item that is not selectable,
 * set its "aria-disabled" attribute to "true" with additional args.
 *
 * The appearance of the menuItem components can be changed by setting the following css variables
 * in the parent project:
 *    --weaseljs-selected-background-color
 *    --weaseljs-selected-color
 *    --weaseljs-menu-item-padding
 */
export function menuItem(action: (item: HTMLElement, ev: Event) => void, ...args: DomElementArg[]): Element {
  const triggerAction = (ev: Event, item: HTMLElement) => {
    if (isDisabled(item)) {
      ev.preventDefault();
    } else {
      action(item, ev);
    }
  }
  return cssMenuItem(
    {role: 'menuitem'},
    ...args,
    dom.on('click', triggerAction),
    // `tabindex="-1"` is automatically added by the onKeyDown helper, making the item selectable by default.
    onKeyDown({ "Enter$": triggerAction })
  );
}

/**
 * A toggleable menu item.
 *
 * This makes sure screen readers correctly announce the menu item as checked/unchecked.
 * You are expected to provide your own UI that reflects the observable as the item content.
 * A classic checkbox input element tied to the observable can be used.
 *
 * The item is generated with tabindex="-1". To generate a menu item that is not selectable,
 * set its "aria-disabled" attribute to "true" through the additional args.
 */
export const menuItemCheckbox = (checked: Observable<boolean>, ...args: DomElementArg[]) => {
  const toggle = (ev: Event, item: HTMLElement) => {
    if (isDisabled(item)) {
      ev.preventDefault();
      return;
    }
    // UI provided has chances to be a classic label+input pair. In that case, we prevent default's browser behavior
    // if we click the label.
    // Without this, browser triggers a programmatic click event on the input when clicking the label. Our click
    // listener would be triggered twice, once for the label, once for the input, resulting in the `checked`
    // observable being toggled twice with one actual user click.
    if (ev.target instanceof Element && ev.target.closest('label') !== null && ev.target.tagName !== 'INPUT') {
      ev.preventDefault();
    }
    checked.set(!checked.get());
  }
  return cssMenuItem(
    {role: 'menuitemcheckbox'},
    dom.attr("aria-checked", use => use(checked) ? "true" : "false"),
    ...args,
    dom.on('click', toggle),
    // `tabindex="-1"` is automatically added by the onKeyDown helper, making the item selectable by default.
    onKeyDown({
      "Enter$": toggle,
      // Space key is used to toggle a checkbox item without closing the parent menu.
      " $": (ev, item) => {
          // We always prevent default here to prevent browser from scrolling.
          ev.preventDefault();
          toggle(ev, item);
      }
    })
  );
}

/**
 * A version of menuItem that's an <a> link element.
 */
export function menuItemLink(...args: DomElementArg[]): Element {
  const preventActionIfDisabled = (ev: Event, item: HTMLElement) => {
    if (isDisabled(item)) {
      ev.preventDefault();
      return;
    }
  }
  return cssMenuItemLink(
    {tabindex: '-1', role: 'menuitem'},
    cssMenuItem.cls(''),
    ...args,
    dom.on('click', preventActionIfDisabled),
    // This prevents propagation, but NOT the default action, which is to open the link.
    onKeyDown({Enter$: (ev, item) => {
      ev.stopPropagation();
      return preventActionIfDisabled(ev, item);
    }})
  );
}

/**
 * A group of menu items with a visible heading, that is correctly announced
 * by screen readers.
 *
 * You should use a menuGroup instead of manually building a menu
 * that has a heading and menu items as siblings. Otherwise, screen readers won't correctly
 * announce the items relationships to the user.
 *
 * Example:
 *   menu(() => [
 *     menuItem(() => {}, 'Ungrouped item'),
 *     menuGroup('Grouped items header',
 *       menuItem(() => {}, 'Grouped item 1'),
 *       menuItem(() => {}, 'Grouped item 2'),
 *     ),
 *   ]),
 */
export function menuGroup(heading: DomElementArg, ...args: DomElementArg[]): Element {
  const headingId = uniqueId(weaselIdPrefix);
  return cssMenuGroup(
    {
      role: 'group',
      'aria-labelledby': headingId,
    },
    dom('div', {id: headingId, role: 'presentation'}, heading),
    ...args
  );
}

export const defaultMenuOptions: IMenuOptions = {
  attach: 'body',
  boundaries: 'viewport',
  placement: 'bottom-start',
  showDelay: 0,
  trigger: ['click', {keys: ['Enter']}],
  modifiers: {
    // gpuAcceleration (true by default) causes a tiny UI artifact: attempting to drag a link, at
    // least in Firefox, causes it to be dragged from a different location on the screen where it
    // actually is, which looks strange. Disabling has no noticeable downsides.
    computeStyle: {gpuAcceleration: false}
  },
};


/**
 * Update the few ARIA attributes related to toggling on/off a menu popup related to a trigger element.
 */
export function updateListAria(
  owner: BaseMenu,
  triggerElem: Element,
  listElem: HTMLElement,
  options: { role: 'menu' | 'listbox' },
) {
  if (!listElem.id) {
    listElem.id = uniqueId(weaselIdPrefix);
  }
  listElem.setAttribute('role', options.role);
  if (options.role === 'listbox') {
    listElem.setAttribute('aria-orientation', 'vertical');
  }
  // The aria-expanded attribute is not always set on the trigger button, in case of a contextmenu trigger for example
  // (see comment in `baseElem` above). Make sure to not add it by mistake in that case.
  if (triggerElem.hasAttribute('aria-expanded')) {
    triggerElem.setAttribute('aria-expanded', 'true');
  }
  triggerElem.setAttribute('aria-controls', listElem.id);
  // Without aria-owns, some screen readers announce unnecessary and verbose context change when closing the menu,
  // because the menu's list is a direct child of the body element and not a child or sibling of the trigger element.
  triggerElem.setAttribute('aria-owns', listElem.id);
  if (options.role === 'menu' && triggerElem.id && !listElem.getAttribute('aria-labelledby')) {
    listElem.setAttribute('aria-labelledby', triggerElem.id);
  }
  owner.onDispose(() => {
    // See comment above when setting the aria-expanded attribute.
    if (triggerElem.hasAttribute('aria-expanded')) {
      triggerElem.setAttribute('aria-expanded', 'false');
    }
    triggerElem.removeAttribute('aria-controls');
    triggerElem.removeAttribute('aria-owns');
  });
}

/**
 * Implementation of the BaseMenu. Extended by Menu and Select.
 */
export class BaseMenu extends Disposable implements IPopupContent {
  // The outer element (required by IPopupContent), which contains _menuContent.
  public readonly content: HTMLElement;

  // The UL element containing the actual menu items.
  protected _menuContent: HTMLElement;

  protected _selected: HTMLElement|null = null;

  // Indicates whether menu rows should be given browser focus when selected.
  // Modified by extending classes to prevent trigger element from losing focus.
  private _focusOnSelected: boolean = true;

  private _allowNothingSelected: boolean;

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

    this._allowNothingSelected = Boolean(options.allowNothingSelected);

    this.content = cssMenuWrap({class: options.menuWrapCssClass || ''},
      this._menuContent = cssMenu({class: options.menuCssClass || ''},
        items,
        stretchContainer ? (elem) => stretchMenuToContainer(elem, stretchContainer) : null,
        mouseOverOnMove((ev) => this._onMouseOver(ev)),
        dom.on('mouseleave', (ev) => this._onMouseLeave(ev)),
        onKeyDown({
          ArrowDown: () => this.nextIndex(),
          ArrowUp: () => this.prevIndex(),
          ArrowLeft: options.isSubMenu ? () => ctl.close(0) : () => {},
          // We disable the right arrow key in case a global shortcut bound to it would collide
          ArrowRight: () => {}
        }),
        (el) => options.modifyContent?.(el, ctl)
      ),
      // Events set on the parent of _menuContent receive events bubbled up from submenus.
      dom.on('click', (ev) => {
        const item = findMenuItem(ev.target as Element);
        if (item && isSelectable(item)) {
          // Items might be checkboxes, in that case we don't want to close the menu on click
          if (item.getAttribute('role') !== 'menuitemcheckbox') {
            ctl.close(0);
          }
        } else {
          ev.stopPropagation();
        }
      }),
      onKeyDown({
        Escape: () => ctl.close(0),
        ...(options.isSubMenu ? {} : {
          Enter: () => ctl.close(0),    // gets bubbled key after action is taken.
          // prevent using the Tab key to navigate: we use arrow keys
          Tab: (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
          },
        }),
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
    const selectables = this._getSelectables();
    if (!selectables.length) { return; }
    const next = this._getNextSelectable(
      this._selected, (elem) => this._findSibling(elem, this._getMenuItems(), 'next'), selectables[0]
    );
    this.setSelected(next);
  }

  protected prevIndex(): void {
    const selectables = this._getSelectables();
    if (!selectables.length) { return; }
    const next = this._getNextSelectable(
      this._selected, (elem) => this._findSibling(elem, this._getMenuItems(), 'prev'), selectables[selectables.length - 1]
    );
    this.setSelected(next);
  }

  private _findSibling(elem: Element | null, items: Element[], direction: 'next' | 'prev'): Element | null {
    if (!elem) { return null; }
    const index = items.indexOf(elem);
    return items[index + (direction === 'next' ? 1 : -1)];
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
    if (this._focusOnSelected) { (elem || this._menuContent).focus(); }
  }

  protected set focusOnSelected(bool: boolean) {
    this._focusOnSelected = bool;
  }

  private _onMouseOver(ev: MouseEvent) {
    if (!isMenuContainer(ev.target as Element)) {
      // If we don't find an item or it's not selectable, intentionally deselect.
      const elem = findMenuItem(ev.target as Element);
      this.setSelected(elem && isSelectable(elem) ? elem : null);
    }
  }

  private _onMouseLeave(ev: MouseEvent) {
    const elem = this._selected;
    if (elem && !elem.classList.contains('weasel-popup-open')) {
      // Don't deselect if there is an open submenu.
      this.setSelected(null);
    }
  }

  private _getMenuItems() {
    return Array.from(this._menuContent.querySelectorAll('[tabindex]')).filter(isMenuItem);
  }

  private _getSelectables() {
    return this._getMenuItems().filter(isSelectable);
  }

  /**
   * Given a starting Element, a function to retrieve the next Element and the element to start over
   * after reaching the last sibling, returns the next selectable Element (based on
   * isSelectable). Returns null if the function to retrieve the next Element returns null. Always
   * returns startElem if returned by getNext function, to prevent an infinite loop.
   */
  private _getNextSelectable(startElem: Element|null,
                             getNext: (elem: Element) => Element|null,
                             firstElem: Element|null): HTMLElement|null {
    let next = this._getNext(startElem, getNext, firstElem);
    while (next && next !== startElem && !isSelectable(next)) { next = this._getNext(next, getNext, firstElem); }
    return next as HTMLElement|null;
  }

  private _getNext(elem: Element|null,
                   getNext: (elem: Element) => Element|null,
                   firstElem: Element|null): Element|null {
    if (!elem) { return firstElem; }
    return getNext(elem) || (this._allowNothingSelected ? null : firstElem);
  }
}

/**
 * Implementation of the Menu. See menu() documentation for usage.
 */
export class Menu extends BaseMenu implements IPopupContent {
  constructor(ctl: IOpenController, items: DomElementArg[], options: IMenuOptions = {}) {
    super(ctl, items, options);
    updateListAria(this, ctl.getTriggerElem(), this._menuContent, {role: 'menu'});

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


function isMenuItem(elem: Element): boolean {
  return elem.hasAttribute('tabIndex')
    && ['menuitem', 'menuitemcheckbox', 'option'].includes(elem.getAttribute('role') || '')
    // Offset height > 0 is used to determine if the element is visible.
    && (elem as HTMLElement).offsetHeight > 0;
}

/**
 * Returns a boolean indicating whether the Element is selectable in the menu.
 */
export function isSelectable(elem: Element): elem is HTMLElement {
  return isMenuItem(elem) && !isDisabled(elem);
}

function isDisabled(elem: Element): boolean {
  return elem?.classList.contains('disabled') || elem?.getAttribute('aria-disabled') === 'true';
}

/**
 * Finds the menu item (role menuitem / menuitemcheckbox / option) that contains elem,
 * within its nearest menu. Items may be nested inside groups, so this is not necessarily
 * a direct child of the menu container.
 */
function findMenuItem(elem: Element) {
  return elem.closest(`.${cssMenu.className} :is([role="menuitem"], [role="menuitemcheckbox"], [role="option"])`);
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
    options.expandIcon ? options.expandIcon() : cssExpandIcon(),
    dom.autoDispose(ctl),

    {'role': 'menuitem', 'aria-expanded': 'false'},

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
    dom.on('click', (ev, elem) => {
      if (options.action && !isDisabled(elem)) {
        options.action(elem, ev);
      } else {
        ev.stopPropagation();
      }
    }),
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
  &.disabled, &[aria-disabled="true"],
  &.disabled:hover, &[aria-disabled="true"]:hover,
  &.disabled:focus, &[aria-disabled="true"]:focus {
    color: grey;
  }
`);

export const cssMenuGroup = styled('div', `
  & [role="presentation"] {
    text-transform: var(--weaseljs-menu-group-text-transform, uppercase);
    padding: var(--weaseljs-menu-item-padding, 8px 24px);
  }
`)

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
  &.disabled, &[aria-disabled="true"] {
    cursor: default;
  }
`);

export const cssMenuDivider = styled((...args: DomElementArg[]) => dom("div", { "aria-hidden": "true" }, ...args), `
  height: 1px;
  width: 100%;
  margin: 4px 0;
  background-color: #D9D9D9;
`);

export const cssExpandIcon = styled('div.weasel-popup-expand-icon', `
  flex: none;
  margin-right: -20px;
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-top: -2px;
  &:after {
    content: '\u25B6\uFE0E';
    display: inline-block;
    text-align: center;
    width: 16px;
    height: 16px;
    font-size: 8px;
  }
`);
