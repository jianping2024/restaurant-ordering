import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  customerMenuBottomSheetBodyClass,
  customerMenuBottomSheetFooterClass,
  customerMenuBottomSheetHandleRowClass,
  customerMenuBottomSheetHeaderClass,
  customerMenuBottomSheetPanelClass,
} from './customer-menu-bottom-sheet-layout';

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, '..');

describe('customer-menu-bottom-sheet-layout', () => {
  it('caps the panel to the dynamic viewport and pins chrome outside the scroller', () => {
    assert.match(customerMenuBottomSheetPanelClass, /max-h-\[100dvh\]/);
    assert.match(customerMenuBottomSheetPanelClass, /\bflex\b/);
    assert.match(customerMenuBottomSheetPanelClass, /flex-col/);
    assert.match(customerMenuBottomSheetPanelClass, /overflow-hidden/);
    assert.match(customerMenuBottomSheetHandleRowClass, /shrink-0/);
    assert.match(customerMenuBottomSheetHeaderClass, /shrink-0/);
    assert.match(customerMenuBottomSheetFooterClass, /shrink-0/);
    assert.match(customerMenuBottomSheetBodyClass, /min-h-0/);
    assert.match(customerMenuBottomSheetBodyClass, /flex-1/);
    assert.match(customerMenuBottomSheetBodyClass, /overflow-y-auto/);
    assert.match(customerMenuBottomSheetBodyClass, /modal-scroll/);
    assert.doesNotMatch(customerMenuBottomSheetBodyClass, /max-h-\[60vh\]/);
    assert.doesNotMatch(customerMenuBottomSheetPanelClass, /max-h-\[60vh\]/);
  });

  it('keeps one sheet chrome that imports the sole layout tokens', () => {
    const sheet = readFileSync(join(webSrc, 'components/menu/CustomerMenuBottomSheet.tsx'), 'utf8');
    assert.match(sheet, /customerMenuBottomSheetPanelClass/);
    assert.match(sheet, /customerMenuBottomSheetBodyClass/);
    assert.doesNotMatch(sheet, /max-h-\[60vh\]/);
    assert.equal((sheet.match(/function CustomerMenuBottomSheet/g) ?? []).length, 1);
  });
});
