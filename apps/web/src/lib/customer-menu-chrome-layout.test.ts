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
  it('uses sole shell width: phone max-w-mobile + lg widen', () => {
    assert.match(CUSTOMER_MENU_SHELL_WIDTH_CLASS, /max-w-mobile/);
    assert.match(CUSTOMER_MENU_SHELL_WIDTH_CLASS, /lg:max-w-\[68rem\]/);
    assert.equal(
      CUSTOMER_MENU_SHELL_WIDTH_CLASS,
      'w-full max-w-mobile lg:max-w-[68rem]',
    );
    assert.ok(customerMenuShellRootClass.includes(CUSTOMER_MENU_SHELL_WIDTH_CLASS));
  });

  it('docks fixed overlays to the centered shell', () => {
    assert.match(customerMenuFixedShellDockClass, /left-1\/2/);
    assert.match(customerMenuFixedShellDockClass, /-translate-x-1\/2/);
    assert.ok(customerMenuNoticeTabShellClass.includes(CUSTOMER_MENU_SHELL_WIDTH_CLASS));
    assert.ok(customerMenuNoticeTabShellClass.includes(CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS));
  });

  it('keeps header trailing controls from shrinking', () => {
    assert.equal(customerMenuHeaderTrailingSlotClass, 'shrink-0');
  });

  it('keeps notice tab below sticky header height token', () => {
    assert.match(CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS, /6\.5rem/);
    assert.doesNotMatch(CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS, /8rem/);
  });
});
