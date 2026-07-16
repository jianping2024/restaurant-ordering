import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estimateTableQrCardHeight,
  fitSingleLineFontSize,
  TABLE_QR_CARD_LAYOUT,
  resolveTableQrGroupLabel,
} from './table-qr-card-layout';

describe('resolveTableQrGroupLabel', () => {
  it('returns ungrouped label when table has no group', () => {
    assert.equal(resolveTableQrGroupLabel('t1', {}, '未分组'), '未分组');
  });

  it('returns group name when assigned', () => {
    assert.equal(resolveTableQrGroupLabel('t1', { t1: '大厅1' }, '未分组'), '大厅1');
  });
});

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
  it('includes the scan CTA section in the card height', () => {
    const height = estimateTableQrCardHeight();
    const minimumExpected =
      TABLE_QR_CARD_LAYOUT.padding * 2
      + TABLE_QR_CARD_LAYOUT.qrSize
      + TABLE_QR_CARD_LAYOUT.scanCtaFontSize * TABLE_QR_CARD_LAYOUT.scanCtaLineHeight;

    assert.ok(height > minimumExpected);
  });
});
