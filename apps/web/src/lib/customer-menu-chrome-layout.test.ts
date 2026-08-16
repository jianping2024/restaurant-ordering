import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS,
  CUSTOMER_MENU_SHELL_WIDTH_CLASS,
  customerMenuFixedShellDockClass,
  customerMenuHeaderTrailingSlotClass,
  customerMenuNoticeTabShellClass,
  customerMenuShellRootClass,
} from './customer-menu-chrome-layout';

describe('customerMenuChromeLayout', () => {
  it('uses the same max-w-mobile shell as the bottom bar', () => {
    assert.match(customerMenuShellRootClass, /max-w-mobile/);
    assert.equal(CUSTOMER_MENU_SHELL_WIDTH_CLASS, 'w-full max-w-mobile');
  });

  it('docks fixed overlays to the centered shell', () => {
    assert.match(customerMenuFixedShellDockClass, /left-1\/2/);
    assert.match(customerMenuFixedShellDockClass, /-translate-x-1\/2/);
    assert.match(customerMenuNoticeTabShellClass, /max-w-mobile/);
    assert.ok(customerMenuNoticeTabShellClass.includes(CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS));
  });

  it('keeps header trailing controls from shrinking', () => {
    assert.equal(customerMenuHeaderTrailingSlotClass, 'shrink-0');
  });

  it('keeps notice tab below sticky header height token', () => {
    assert.match(CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS, /8rem/);
    assert.doesNotMatch(CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS, /7\.5rem/);
  });
});
