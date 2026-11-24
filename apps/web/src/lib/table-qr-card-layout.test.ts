import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estimateTableQrCardHeight,
  fitSingleLineFontSize,
  TABLE_QR_CARD_LAYOUT,
  TABLE_QR_PLATE_MM,
  TABLE_QR_PX_PER_MM,
  tableQrHeaderBandHeight,
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

describe('TABLE_QR_CARD_LAYOUT aluminum 50×55', () => {
  it('locks face to plate aspect and 41mm QR', () => {
    const { width, height, qrSize, paddingX, paddingTop, paddingBottom } = TABLE_QR_CARD_LAYOUT;
    assert.equal(width, TABLE_QR_PLATE_MM.widthMm * TABLE_QR_PX_PER_MM);
    assert.equal(height, TABLE_QR_PLATE_MM.heightMm * TABLE_QR_PX_PER_MM);
    assert.equal(qrSize, TABLE_QR_PLATE_MM.qrMm * TABLE_QR_PX_PER_MM);
    assert.equal(paddingX, TABLE_QR_PLATE_MM.sideMarginMm * TABLE_QR_PX_PER_MM);
    assert.equal(width / TABLE_QR_PLATE_MM.widthMm, height / TABLE_QR_PLATE_MM.heightMm);
    assert.equal((width - qrSize) / 2, paddingX);
    assert.equal(
      height,
      paddingTop + paddingBottom + qrSize + tableQrHeaderBandHeight(),
    );
    assert.equal(estimateTableQrCardHeight(), height);
  });
});
