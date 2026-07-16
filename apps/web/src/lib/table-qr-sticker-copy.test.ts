import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveTableQrStickerLocale,
  resolveTableQrStickerScanCta,
} from './table-qr-sticker-copy';

describe('resolveTableQrStickerLocale', () => {
  it('falls back to pt when locale is missing', () => {
    assert.equal(resolveTableQrStickerLocale(null), 'pt');
  });
});

describe('resolveTableQrStickerScanCta', () => {
  it('returns Chinese CTA for zh locale', () => {
    assert.equal(resolveTableQrStickerScanCta('zh'), '扫码开始点餐 ›');
  });

  it('returns Portuguese CTA by default', () => {
    assert.equal(resolveTableQrStickerScanCta(undefined), 'Digitalize para pedir ›');
  });
});
