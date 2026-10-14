# 0.2.0

- new menu `modifyContent` option that allows to apply arbitrary DOM arguments to the menu's internal `<ul>`
- menus and selects now better support assistive technologies, especially screen readers, thanks to following appropriate ARIA design patterns
- to expose a menu item as disabled, applying the `aria-disabled="true"` is now supported, and recommended (see below)
- the `menuItem` helper has been updated to better support assistive technologies
- a new `menuItemCheckbox` menu helper can be used to create checkbox menu items supporting assistive technologies
- a new `menuGroup` menu helper can be used to create menu sub-groups supporting assistive technologies
- a new `isSelectable` menu helper can be used to help when building your own custom menu items
- select trigger element is now a `<button>` instead of a `<div>`, :warning: so you might need to update related CSS
- typing in selects to focus a specific item is now ignored when pressing Ctrl, Command, Alt or Windows/Super key.
- menu triggers now open on `Enter` by default.
- `Escape` in a submenu now closes only that submenu

## Breaking changes related to accessibility

Version 0.2.0 has better support for screen reader and assistive technologies on menus and selects, thanks to following ARIA design patterns. Because of that, usage of _menus_ is more strict, and what is considered a "menu item" slightly changed.

> [!WARNING]
> The weasel.js's `menu` should be exclusively used to render a dropdown containing a list of actions as intended by [the Menu ARIA design pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/). If you realize you need to implement something not matching that use case, create your own popup content with the `popup` related functions.

You'll need to update the implementation of any _custom_ menu item you have. It is also strongly recommended to update the implementation of any disabled menu items.

- to expose a menu item as _disabled_, use the `aria-disabled="true"` attribute instead of (or in addition to) the `disabled` class. Not doing that prevents users of tools like screen readers to understand the items are disabled.
- a custom menu item now requires a specific `role` in addition to a `tabindex="-1"` attribute. It can either be `menuitem` or `menuitemcheckbox`, depending on whether or not you want to expose an item with a boolean state that can be toggled. Check out the new `menuItemCheckbox` helper for more info.
- when building a custom menu item click callback, use the included `isSelectable` test to prevent the menu item action from being triggered when it should not.
