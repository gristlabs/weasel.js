import {dom, DomCreateFunc, DomElementMethod, styled} from 'grainjs';
import defaults = require('lodash/defaults');
import {IPopupOptions, setPopupToCreateDom} from './popup';

/**
 * Tooltip accepts all the options of other popup methods, plus a couple more.
 *
 * If both .content and .title options are omitted, it shows triggerElem's title attribute (but
 * note that browser's default behavior for showing title attribute remains; to avoid it, use the
 * .title option and don't set triggerElem's attribute).
 */
export interface ITooltipOptions extends IPopupOptions {
  content?: DomElementMethod;   // Use this for tooltip content, overriding 'title' attr or option.
  title?: string;               // Tooltip title to show, when triggerElem has no title attribute.
  theme?: ITooltipTheme;        // Allow using a custom CSS theme for the tooltip.
}

/**
 * Theming the tooltip only requires theming the main element. It includes custom CSS properties
 * for customizing the arrow as well (see cssTooltip below).
 */
export interface ITooltipTheme {
  tooltip: DomCreateFunc<Element>;
}

const defaultTooltipOptions: ITooltipOptions = {
  attach: 'body',
  boundaries: 'viewport',
  placement: 'top',
  showDelay: 0,
  trigger: ['hover', 'focus'],
};

/**
 * Usage:
 *    dom('div', tooltip({title: "Hello"}))
 *    dom('div', tooltip({content: () => dom('b', 'World'), placement: 'bottom'}))
 * It roughly replicates Popper's tooltip feautres from https://popper.js.org/tooltip-documentation.html
 *
 * Note that we do NOT turn off the element's title attribute (if present). Neither does the
 * popper-tooltip library. The recommendation is simply to avoid the title attribute, and pass
 * `title` (or `content`) as a tooltip option.
 */
export function tooltip(options?: ITooltipOptions): DomElementMethod {
  return (elem) => tooltipElem(elem, options);
}
export function tooltipElem(triggerElem: Element, options: ITooltipOptions = {}): void {
  options = defaults({}, options, defaultTooltipOptions);
  setPopupToCreateDom(triggerElem, () => _createDom(triggerElem, options), options);
}

/**
 * Helper that creates an actual tooltip, with some styles and a little arrow.
 */
function _createDom(triggerElem: Element, options: ITooltipOptions) {
  const title = triggerElem.getAttribute('title') || options.title || "";
  const theme = options.theme || defaultTooltipTheme;
  return theme.tooltip({role: 'tooltip'},
    cssTooltipArrow({'x-arrow': true}),
    dom('div', options.content || dom.text(title)),
  );
}

/*
 * An alternative implementation could look like this. (This example is included to illustrate the
 * usage of a class for a popup.)
 *
 * function tooltipElem(triggerElem: Element, options: ITooltipOptions = {}): void {
 *   options = defaults({}, options, defaultTooltipOptions);
 *   return setPopupToFunc(triggerElem, () => Tooltip.create(null, triggerElem, options), options);
 * }
 *
 * class Tooltip extends Disposable {
 *   public readonly content: Element;
 *   constructor(triggerElem: Element, options: ITooltipOptions) {
 *     super();
 *     this.content = _createDom(triggerElem, options);
 *     this.onDispose(() => domDispose(this.content));
 *   }
 * }
 */

// Note that we use two custom properties to make tooltips easier to customize:
//    --tooltip-bg-color changes the background color for the tooltip and arrow.
//    --tooltip-arrow-size sets the size of the tooltip arrow.
const cssTooltip = styled('div', `
  --tooltip-bg-color: #FFC107;
  --tooltip-arrow-size: 5px;
  position: absolute;
  background: var(--tooltip-bg-color);
  color: black;
  width: 100px;
  border-radius: 3px;
  box-shadow: 0 0 2px rgba(0,0,0,0.5);
  padding: 10px;
  text-align: center;

  &[x-placement^="bottom"] { margin-top: var(--tooltip-arrow-size); }
  &[x-placement^="top"] { margin-bottom: var(--tooltip-arrow-size); }
  &[x-placement^="left"] { margin-right: var(--tooltip-arrow-size); }
  &[x-placement^="right"] { margin-left: var(--tooltip-arrow-size); }
`);

const cssTooltipArrow = styled('div', `
  position: absolute;
  width: 0;
  height: 0;
  border: solid transparent var(--tooltip-arrow-size);

  .${cssTooltip.className}[x-placement^="bottom"] & {
    border-top-width: 0;
    border-bottom-color: var(--tooltip-bg-color);
    top: calc(var(--tooltip-arrow-size) * -1);
    left: calc(50% - var(--tooltip-arrow-size));
    margin: 0 var(--tooltip-arrow-size);
  }
  .${cssTooltip.className}[x-placement^="top"] & {
    border-bottom-width: 0;
    border-top-color: var(--tooltip-bg-color);
    bottom: calc(var(--tooltip-arrow-size) * -1);
    left: calc(50% - var(--tooltip-arrow-size));
    margin: 0 var(--tooltip-arrow-size);
  }
  .${cssTooltip.className}[x-placement^="left"] & {
    border-right-width: 0;
    border-left-color: var(--tooltip-bg-color);
    right: calc(var(--tooltip-arrow-size) * -1);
    top: calc(50% - var(--tooltip-arrow-size));
    margin: var(--tooltip-arrow-size) 0;
  }
  .${cssTooltip.className}[x-placement^="right"] & {
    border-left-width: 0;
    border-right-color: var(--tooltip-bg-color);
    left: calc(var(--tooltip-arrow-size) * -1);
    top: calc(50% - var(--tooltip-arrow-size));
    margin: var(--tooltip-arrow-size) 0;
  }
`);

/**
 * The default tooltip style; this one matches popper.js tooltip library.
 */
export const defaultTooltipTheme: ITooltipTheme = {
  tooltip: cssTooltip,
};

export const cssDarkTooltip = styled(defaultTooltipTheme.tooltip, `
  --tooltip-arrow-size: 6px;
  --tooltip-bg-color: black;
  color: white;
  width: auto;
  font-family: sans-serif;
  font-size: 10pt;
`);

/**
 * Offer another tooltip style, usable by passing {theme: darkTooltipTheme} in tooltip options.
 */
export const darkTooltipTheme: ITooltipTheme = {
  tooltip: cssDarkTooltip,
};
