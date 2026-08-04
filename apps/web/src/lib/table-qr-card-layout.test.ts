import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estimateTableQrCardHeight,
  fitSingleLineFontSize,
  TABLE_QR_CARD_LAYOUT,
} from './table-qr-card-layout';

describe('fitSingleLineFontSize', () => {
  it('shrinks font until text fits', () => {
    const size = fitSingleLineFontSize(
      'VERY-LONG-TABLE',
      100,
      42,
      20,
      (value, fontSize) => value.length * fontSize * 0.6,
    );
    assert.ok(size < 42);
    assert.ok(size >= 20);
  });
});

describe('estimateTableQrCardHeight', () => {
  it('includes restaurant, product, and scan CTA sections', () => {
    const height = estimateTableQrCardHeight();
    const minimumExpected =
      TABLE_QR_CARD_LAYOUT.padding * 2
      + TABLE_QR_CARD_LAYOUT.qrSize
      + TABLE_QR_CARD_LAYOUT.restaurantNameFontSize * TABLE_QR_CARD_LAYOUT.restaurantNameLineHeight
      + TABLE_QR_CARD_LAYOUT.productNameFontSize * TABLE_QR_CARD_LAYOUT.productNameLineHeight
      + TABLE_QR_CARD_LAYOUT.scanCtaFontSize * TABLE_QR_CARD_LAYOUT.scanCtaLineHeight;

    assert.ok(height > minimumExpected);
  });
});
