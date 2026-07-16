import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  customerMenuBottomBarIconClass,
  customerMenuBottomBarIconGapClass,
  customerMenuBottomBarRowClass,
  customerMenuPageBottomPaddingClass,
  CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS,
  CUSTOMER_MENU_PAGE_BOTTOM_PADDING_WITH_FOOTER,
} from './customer-menu-bottom-bar-layout';

describe('customerMenuPageBottomPaddingClass', () => {
  it('reserves bar height + safe area when footer is visible via a static Tailwind class', () => {
    const cls = customerMenuPageBottomPaddingClass(true);
    assert.equal(cls, CUSTOMER_MENU_PAGE_BOTTOM_PADDING_WITH_FOOTER);
    assert.equal(
      cls,
      'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.5rem)]',
    );
    assert.equal(CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS, 'h-14');
  });

  it('keeps the footer padding class fully static in source for Tailwind JIT', () => {
    const sourcePath = join(dirname(fileURLToPath(import.meta.url)), 'customer-menu-bottom-bar-layout.ts');
    const source = readFileSync(sourcePath, 'utf8');
    assert.match(
      source,
      /'pb-\[calc\(3\.5rem\+env\(safe-area-inset-bottom,0px\)\+0\.5rem\)\]'/,
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
});

describe('customer menu bottom bar visual tokens', () => {
  it('uses enlarged icons and consistent icon-to-text spacing', () => {
    assert.match(customerMenuBottomBarIconClass, /h-8 w-8/);
    assert.equal(customerMenuBottomBarIconGapClass, 'gap-4');
  });
});
