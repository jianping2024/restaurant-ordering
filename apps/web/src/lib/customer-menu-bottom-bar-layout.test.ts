import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { CUSTOMER_MENU_TYPE } from './customer-menu-type';
import {
  customerMenuBottomBarCountBadgeClass,
  customerMenuBottomBarDockClass,
  customerMenuBottomBarDockInnerClass,
  customerMenuBottomBarIconClass,
  customerMenuBottomBarIconGapClass,
  customerMenuBottomBarPrimaryActionClass,
  customerMenuBottomBarRowClass,
  customerMenuPageBottomPaddingClass,
  formatCustomerMenuFooterBadgeCount,
  CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS,
  CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS,
  CUSTOMER_MENU_PAGE_BOTTOM_PADDING_WITH_FOOTER,
} from './customer-menu-bottom-bar-layout';
import { CUSTOMER_MENU_SHELL_WIDTH_CLASS } from './customer-menu-chrome-layout';

const CUSTOMER_MENU_BOTTOM_SAFE_VAR = '--mesa-customer-menu-bottom-safe';

describe('formatCustomerMenuFooterBadgeCount', () => {
  it('is the sole badge label — empty, plain, then 99+', () => {
    assert.equal(formatCustomerMenuFooterBadgeCount(0), '');
    assert.equal(formatCustomerMenuFooterBadgeCount(5), '5');
    assert.equal(formatCustomerMenuFooterBadgeCount(99), '99');
    assert.equal(formatCustomerMenuFooterBadgeCount(100), '99+');
    assert.equal(formatCustomerMenuFooterBadgeCount(1000), '99+');
  });
});

describe('CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS', () => {
  it('pads via the sole CSS bottom-inset variable', () => {
    assert.equal(
      CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS,
      `pb-[var(${CUSTOMER_MENU_BOTTOM_SAFE_VAR})]`,
    );
  });
});

describe('customerMenuPageBottomPaddingClass', () => {
  it('reserves bar height + same inset var when footer is visible via a static Tailwind class', () => {
    const cls = customerMenuPageBottomPaddingClass(true);
    assert.equal(cls, CUSTOMER_MENU_PAGE_BOTTOM_PADDING_WITH_FOOTER);
    assert.equal(
      cls,
      `pb-[calc(3.5rem+var(${CUSTOMER_MENU_BOTTOM_SAFE_VAR})+0.5rem)]`,
    );
    assert.equal(CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS, 'h-14');
  });

  it('keeps the footer padding class fully static in source for Tailwind JIT', () => {
    const sourcePath = join(dirname(fileURLToPath(import.meta.url)), 'customer-menu-bottom-bar-layout.ts');
    const source = readFileSync(sourcePath, 'utf8');
    assert.match(
      source,
      /'pb-\[calc\(3\.5rem\+var\(--mesa-customer-menu-bottom-safe\)\+0\.5rem\)\]'/,
    );
    assert.doesNotMatch(source, /pb-\[calc\(\$\{/);
  });

  it('uses lighter padding when footer is hidden', () => {
    assert.equal(customerMenuPageBottomPaddingClass(false), 'pb-16');
  });
});

describe('customerMenuBottomBar dock float', () => {
  it('floats above the sole inset var (not flush bottom-0)', () => {
    assert.ok(customerMenuBottomBarDockClass.includes(CUSTOMER_MENU_SHELL_WIDTH_CLASS));
    assert.ok(customerMenuBottomBarDockClass.includes(`bottom-[var(${CUSTOMER_MENU_BOTTOM_SAFE_VAR})]`));
    assert.ok(!customerMenuBottomBarDockClass.includes('bottom-0'));
    assert.ok(customerMenuBottomBarDockInnerClass.includes('rounded-2xl'));
  });

  it('pins summary and action to opposite edges with symmetric horizontal padding', () => {
    assert.match(customerMenuBottomBarRowClass, /justify-between/);
    assert.match(customerMenuBottomBarRowClass, /px-4/);
  });
});

describe('customer menu bottom bar visual tokens', () => {
  it('uses enlarged icons and consistent icon-to-text spacing', () => {
    assert.match(customerMenuBottomBarIconClass, /h-8 w-8/);
    assert.equal(customerMenuBottomBarIconGapClass, 'gap-4');
  });

  it('uses shared footer primary action typography and sole badge chip class', () => {
    assert.match(customerMenuBottomBarPrimaryActionClass, new RegExp(CUSTOMER_MENU_TYPE.footerPrimaryAction));
    assert.match(customerMenuBottomBarPrimaryActionClass, /text-base/);
    assert.match(customerMenuBottomBarCountBadgeClass, /rounded-full/);
  });
});

describe('one representation — customer menu bottom inset + badge', () => {
  it('globals defines the inset formula once; dock floats; consumers share pad token; footer uses sole badge formatter', () => {
    const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
    const globals = readFileSync(join(webSrc, 'app/globals.css'), 'utf8');
    const formula =
      /--mesa-customer-menu-bottom-safe:\s*max\(3rem,\s*env\(safe-area-inset-bottom,\s*0px\)\);/;
    assert.match(globals, formula);
    assert.equal((globals.match(/--mesa-customer-menu-bottom-safe:/g) ?? []).length, 1);

    const layout = readFileSync(join(webSrc, 'lib/customer-menu-bottom-bar-layout.ts'), 'utf8');
    assert.match(layout, /bottom-\[var\(--mesa-customer-menu-bottom-safe\)\]/);
    assert.equal((layout.match(/function formatCustomerMenuFooterBadgeCount/g) ?? []).length, 1);

    const footer = readFileSync(join(webSrc, 'components/menu/CustomerMenuFooter.tsx'), 'utf8');
    assert.match(footer, /formatCustomerMenuFooterBadgeCount/);
    assert.match(footer, /FooterIconCountBadge/);
    assert.doesNotMatch(footer, /CUSTOMER_MENU_TYPE\.footerSummary/);
    // No parallel inline badge chip class on footer
    assert.doesNotMatch(footer, /absolute -right-1 -top-1 flex h-\[18px\]/);
    // Ordered body shows amount only — count lives on the badge (aria keeps full label)
    assert.match(
      footer,
      /function OrderedSummary[\s\S]*?<FooterIconCountBadge count=\{submittedCount\} \/>[\s\S]*?<FooterAmount/,
    );

    const sheet = readFileSync(join(webSrc, 'components/menu/CustomerMenuBottomSheet.tsx'), 'utf8');
    assert.match(sheet, /CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS/);
    assert.doesNotMatch(sheet, /pb-\[max\([^)]*safe-area-inset-bottom/);

    const detail = readFileSync(join(webSrc, 'lib/customer-menu-item-detail-layout.ts'), 'utf8');
    assert.match(detail, /CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS/);
    assert.doesNotMatch(detail, /pb-\[max\([^)]*safe-area-inset-bottom/);
  });
});
