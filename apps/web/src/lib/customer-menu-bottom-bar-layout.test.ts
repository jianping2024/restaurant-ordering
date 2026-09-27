import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { CUSTOMER_MENU_TYPE } from './customer-menu-type';
import {
  customerMenuBottomBarDockClass,
  customerMenuBottomBarIconClass,
  customerMenuBottomBarIconGapClass,
  customerMenuBottomBarPrimaryActionClass,
  customerMenuBottomBarRowClass,
  customerMenuPageBottomPaddingClass,
  CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS,
  CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS,
  CUSTOMER_MENU_PAGE_BOTTOM_PADDING_WITH_FOOTER,
} from './customer-menu-bottom-bar-layout';
import { CUSTOMER_MENU_SHELL_WIDTH_CLASS } from './customer-menu-chrome-layout';

const CUSTOMER_MENU_BOTTOM_SAFE_VAR = '--mesa-customer-menu-bottom-safe';

describe('CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS', () => {
  it('pads via the sole CSS safe-area variable', () => {
    assert.equal(
      CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS,
      `pb-[var(${CUSTOMER_MENU_BOTTOM_SAFE_VAR})]`,
    );
  });
});

describe('customerMenuPageBottomPaddingClass', () => {
  it('reserves bar height + same safe-area var when footer is visible via a static Tailwind class', () => {
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

describe('customerMenuBottomBarRowClass', () => {
  it('pins summary and action to opposite edges with symmetric horizontal padding', () => {
    assert.match(customerMenuBottomBarRowClass, /justify-between/);
    assert.match(customerMenuBottomBarRowClass, /px-4/);
  });

  it('reuses the shared customer menu shell width and sole safe-area pad', () => {
    assert.ok(customerMenuBottomBarDockClass.includes(CUSTOMER_MENU_SHELL_WIDTH_CLASS));
    assert.ok(customerMenuBottomBarDockClass.includes(CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS));
  });
});

describe('customer menu bottom bar visual tokens', () => {
  it('uses enlarged icons and consistent icon-to-text spacing', () => {
    assert.match(customerMenuBottomBarIconClass, /h-8 w-8/);
    assert.equal(customerMenuBottomBarIconGapClass, 'gap-4');
  });

  it('uses shared footer primary action typography', () => {
    assert.match(customerMenuBottomBarPrimaryActionClass, new RegExp(CUSTOMER_MENU_TYPE.footerPrimaryAction));
    assert.match(customerMenuBottomBarPrimaryActionClass, /text-base/);
  });
});

describe('one representation — customer menu bottom safe-area', () => {
  it('globals defines the inset formula once; consumers only reference the pad token', () => {
    const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
    const globals = readFileSync(join(webSrc, 'app/globals.css'), 'utf8');
    const formula = /--mesa-customer-menu-bottom-safe:\s*max\(0\.75rem,\s*env\(safe-area-inset-bottom,\s*0px\)\);/;
    assert.match(globals, formula);
    assert.equal((globals.match(/--mesa-customer-menu-bottom-safe:/g) ?? []).length, 1);

    const consumerFiles = [
      'lib/customer-menu-bottom-bar-layout.ts',
      'lib/customer-menu-item-detail-layout.ts',
      'components/menu/CustomerMenuBottomSheet.tsx',
    ].map((rel) => join(webSrc, rel));
    const inlineSafeAreaPb = /pb-\[max\([^)]*safe-area-inset-bottom/;
    for (const path of consumerFiles) {
      const source = readFileSync(path, 'utf8');
      assert.doesNotMatch(source, inlineSafeAreaPb);
      if (path.endsWith('customer-menu-bottom-bar-layout.ts')) {
        assert.match(source, /CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS/);
        assert.match(source, /var\(--mesa-customer-menu-bottom-safe\)/);
        continue;
      }
      assert.match(source, /CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS/);
    }
  });
});
