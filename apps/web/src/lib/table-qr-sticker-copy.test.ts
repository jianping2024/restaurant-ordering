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
    assert.equal(resolveTableQrStickerScanCta('zh'), '点餐 ›');
  });

  it('returns Portuguese CTA by default', () => {
    assert.equal(resolveTableQrStickerScanCta(undefined), 'Peça já ›');
  });

  it('returns Spanish CTA for es locale', () => {
    assert.equal(resolveTableQrStickerScanCta('es'), 'Pida ya ›');
  });

  it('returns French CTA for fr locale', () => {
    assert.equal(resolveTableQrStickerScanCta('fr'), 'Commandez ›');
  });

  it('returns German CTA for de locale', () => {
    assert.equal(resolveTableQrStickerScanCta('de'), 'Jetzt bestellen ›');
  });
});
