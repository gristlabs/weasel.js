import {Disposable, dom, domDispose, Holder, IDisposable} from 'grainjs';
import defaultsDeep = require('lodash/defaultsDeep');
import defaultTo = require('lodash/defaultTo');
import noop = require('lodash/noop');
import Popper from 'popper.js';

/**
 * On what event the trigger element opens the popup. E.g. 'hover' is suitable for a tooltip,
 * while 'click' is suitable for a dropdown menu.
 */
type Trigger  = 'click' | 'hover' | 'focus' | AttachTriggerFunc;

/**
 * AttachTriggerFunc allows setting custom trigger events in a callback function to toggle the
 * menu open state.
 */
type AttachTriggerFunc = (triggerElem: Element, ctl: PopupControl) => void;

/**
 * Options available to setPopup* methods.
 */
export interface IPopupOptions {
  // Placement of popup, as for Popper options, e.g. "top", "bottom-end" or "right-start".
  placement?: Popper.Placement;

  // To which element to append the popup content. Null means triggerElem.parentNode and is the
  // default; string is a selector for the closest matching ancestor of triggerElem, e.g. 'body'.
  attach?: Element|string|null;

  // Boundaries for the placement of the popup. The default is 'viewport'. This determines the
  // values of modifiers.flip.boundariesElement and modifiers.preventOverflow.boundariesElement.
  // Use null to use the defaults from popper.js. These may be set individually via modifiers.
  boundaries?: Element|'scrollParent'|'window'|'viewport'|null;

  // On what events, the popup is triggered.
  trigger?: Trigger[];

  showDelay?: number;       // Default delay to show the popup. Defaults to 0.
  hideDelay?: number;       // Default delay to hide the popup. Defaults to 0.

  // Modifiers passed directly to the underlying Popper library.
  // See https://popper.js.org/popper-documentation.html#Popper.Defaults
  // Some useful ones include:
  //  .offset.offset: Offset of popup relative to trigger. Default 0 (but affected by arrow).
  modifiers?: Popper.Modifiers;

  // The popup controller is normally created automatically, but may be created separately in
  // order to keep a reference to it; in that case it may be passed in with the options, and it is
  // the caller's responsibility to ensure it gets disposed.
  controller?: PopupControl;
}

/**
 * Helper passed to IPopupFunc which represents a currently-open popup. User may use
 * .autoDispose() and .onDispose() methods which will trigger when the popup is closed.
 */
export interface IOpenController extends Disposable {
  /**
   * Closes the popup. Uses a default delay if delayMs is omitted.
   */
  close(delayMs?: number): void;

  /**
   * Sets css class `cls` on elem while this popup is open, defaulting to "weasel-popup-open".
   * Removes the class on close.
   */
  setOpenClass(elem: Element, cls?: string): void;

  /**
   * Returns the trigger element that opened this popup.
   */
  getTriggerElem(): Element;

  // Note that .autoDispose() and .onDispose() methods from grainjs Disposable are available,
  // and triggered when the popup is closed.
}

/**
 * Type for the basic function which gets called to open a generic popup. The parameter allows
 * extending IPopupOptions with extra parameters specific to a given popup.
 */
export type IPopupFunc<T extends IPopupOptions = IPopupOptions> =
  (ctl: IOpenController, options: T) => IPopupContent;

/**
 * Return value of IPopupFunc: a popup is a disposable object, whose .content property contains
 * the element to show. This object gets disposed when the popup is closed.
 *
 * The first element in content matching the '[x-arrow]' selector will be used as the arrow.
 */
export interface IPopupContent extends IDisposable {
  readonly content: Element;

  // Called before content is removed from DOM. (Note that disposers run after.)
  onRemove?(): void;
}

/**
 * Type for a function to create a popup as a DOM element; usable with setPopupToCreateDom().
 * This is a somewhat simpler interface than IPopupFunc.
 */
export type IPopupDomCreator = (ctl: IOpenController) => Element;

/**
 * The basic interface to attach popup behavior to a trigger element. According to options.trigger
 * events events on triggerElem, calls openFunc(ctl, options) to open a popup, and disposes the
 * returned value to close it. Returns the same controller that's passed to openFunc.
 *
 * Note that there is no default for options.trigger: if it's not specified, no events will
 * trigger this popup.
 */
export function setPopupToFunc<T extends IPopupOptions = IPopupOptions>(
    triggerElem: Element, openFunc: IPopupFunc<T>, options: T): PopupControl<T> {
  let ctl = options.controller as PopupControl<T>;
  if (!ctl) {
    ctl = PopupControl.create(null) as PopupControl<T>;
    dom.autoDisposeElem(triggerElem, ctl);
  }
  ctl.attachElem(triggerElem, openFunc, options);
  return ctl;
}

/**
 * Attaches the given element on open, detaches it on close. Useful e.g. for a static tooltip.
 */
export function setPopupToAttach(triggerElem: Element, content: Element,
                                 options: IPopupOptions): PopupControl {
  const openResult: IPopupContent = {content, dispose: noop};
  return setPopupToFunc(triggerElem, () => openResult, options);
}

/**
 * Attaches the element returned by the given func on open, detaches and disposes it on close.
 */
export function setPopupToCreateDom(triggerElem: Element, domCreator: IPopupDomCreator,
                                    options: IPopupOptions): PopupControl {
  function openFunc(ctl: IOpenController) {
    const content = domCreator(ctl);
    function dispose() { domDispose(content); }
    return {content, dispose};
  }
  return setPopupToFunc(triggerElem, openFunc, options);
}

// Helper type for maintaining setTimeout() timers.
type TimerId = ReturnType<typeof setTimeout>;

/**
 * PopupControl allows the popup instances to open/close/update the popup as needed. The
 * parameter T allows popups to understand extra options and receive them via the open() call.
 */
export class PopupControl<T extends IPopupOptions = IPopupOptions> extends Disposable {
  private _holder = Holder.create<OpenPopupHelper>(this);
  private _closeTimer?: TimerId;
  private _openTimer?: TimerId;
  private _open: (opts: IPopupOptions) => void = noop;    // Only set once mounted.
  private _close: () => void = noop;
  private _showDelay: number = 0;
  private _hideDelay: number = 0;

  public attachElem(triggerElem: Element, openFunc: IPopupFunc<T>, options: T): void {
    this._showDelay = options.showDelay || 0;
    this._hideDelay = options.hideDelay || 0;

    this._open = (openOptions: IPopupOptions) => {
      this._openTimer = undefined;
      defaultsDeep(openOptions, options);
      OpenPopupHelper.create(this._holder, triggerElem, openFunc as IPopupFunc, openOptions, this);
    };
    this._close = () => {
      this._closeTimer = undefined;
      this._holder.clear();
    };

    if (options.trigger) {
      for (const trigger of options.trigger) {
        if (typeof trigger === 'function') {
          // Call instances of AttachTriggerFunc to attach any custom trigger events.
          trigger(triggerElem, this);
        } else {
          switch (trigger) {
            case 'click':
              dom.onElem(triggerElem, 'click', () => this.toggle());
              break;
            case 'focus':
              dom.onElem(triggerElem, 'focus', () => this.open());
              dom.onElem(triggerElem, 'blur', () => this.close());
              break;
            case 'hover':
              dom.onElem(triggerElem, 'mouseenter', () => this.open());
              dom.onElem(triggerElem, 'mouseleave', () => this.close());
              break;
          }
        }
      }
    }
  }

  /**
   * Open the popup. If reopen is true, it would replace a current open popup; otherwise if
   * this popup is already opened, the call is ignored.
   */
  public open(options: Partial<T> = {}, reopen: boolean = false) {
    const showDelay: number = defaultTo(options.showDelay, this._showDelay);

    // Ensure open() call cancels a delayed close() call.
    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = undefined;
    }
    if (reopen || (this._holder.isEmpty() && !this._openTimer)) {
      this._openTimer = setTimeout(() => this._open(options), showDelay);
    }
  }

  /**
   * Close the popup, if it is open.
   */
  public close(delayMs: number = this._hideDelay) {
    // Ensure closing cancels a delayed opening and vice versa.
    if (this._openTimer) {
      clearTimeout(this._openTimer);
      this._openTimer = undefined;
    }
    this._closeTimer = setTimeout(this._close, delayMs);
  }

  /**
   * Close the popup if it's open, open it otherwise.
   */
  public toggle() {
    this._holder.isEmpty() ? this.open({}, true) : this.close();
  }

  /**
   * Returns whether the popup is currently open.
   */
  public isOpen(): boolean {
    return !this._holder.isEmpty();
  }

  /**
   * Schedules a UI update for the popup's position.
   */
  public update() {
    const helper = this._holder.get();
    if (helper) { helper.update(); }
  }
}

/**
 * An internal class representing a single instance of the OPEN popup. This light-weight object is
 * created to open a popup and is disposed to close it.
 */
class OpenPopupHelper extends Disposable {
  private _popper: Popper;

  constructor(private _triggerElem: Element, openFunc: IPopupFunc, options: IPopupOptions, private _ctl: PopupControl) {
    super();

    // Once this object is disposed, unset all fields for easier detection of bugs.
    this.wipeOnDispose();

    // Call the opener function, and dispose the result when closed.
    const popupContent: IPopupContent = this.autoDispose(openFunc(this, options));
    const {content, onRemove = noop} = popupContent;

    // Find the requested attachment container.
    const containerElem = _getContainer(_triggerElem, options.attach || null);
    if (containerElem) {
      containerElem.appendChild(content);
      this.onDispose(() => { onRemove.call(popupContent); content.remove(); });
    }

    // Prepare and create the Popper instance, which places the content according to the options.
    const popperOptions: Popper.PopperOptions = {
      placement: options.placement || 'bottom',
      modifiers: (options.boundaries ?
        defaultsDeep(options.modifiers, {
          flip: {boundariesElement: options.boundaries},
          preventOverflow: {boundariesElement: options.boundaries},
        }) :
        options.modifiers
      ),
    };
    this._popper = new Popper(_triggerElem, content, popperOptions);
    this.onDispose(() => this._popper.destroy());
    this.setOpenClass(_triggerElem);

    // On click anywhere on the page (outside triggerElem or popup content), close it.
    this.autoDispose(dom.onElem(document, 'click', (evt) => {
      const target: Node|null = evt.target as Node;
      if (target && !content.contains(target) && !_triggerElem.contains(target)) {
        this.dispose();
      }
    }, {useCapture: true}));
  }

  /**
   * Closes the popup. Uses a default delay if delayMs is omitted.
   */
  public close(delayMs?: number) { this._ctl.close(delayMs); }

  /**
   * Sets css class `cls` on elem while this popup is open, defaulting to "weasel-popup-open".
   * Removes the class on close. This is set automatically on triggerElem for styling convenience.
   */
  public setOpenClass(elem: Element, cls: string = 'weasel-popup-open') {
    elem.classList.add(cls);
    this.onDispose(() => elem.classList.remove(cls));
  }

  /**
   * Returns the trigger element that opened this popup.
   */
  public getTriggerElem(): Element {
    return this._triggerElem;
  }

  public update() { this._popper.scheduleUpdate(); }
}

/**
 * Helper that finds the container according to IPopupOptions.container. Null means
 * elem.parentNode; string is a selector for the closest matching ancestor, e.g. 'body'.
 */
function _getContainer(elem: Element, attachElem: Element|string|null): Node|null {
  return (typeof attachElem === 'string') ? elem.closest(attachElem) :
    (attachElem || elem.parentNode);
}
