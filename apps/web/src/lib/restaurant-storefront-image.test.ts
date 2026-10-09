import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_STOREFRONT_COVER_URL,
  resolveStorefrontCoverUrl,
} from './restaurant-storefront-image';

describe('resolveStorefrontCoverUrl', () => {
  it('uses default when cover is empty', () => {
    assert.equal(resolveStorefrontCoverUrl(null), DEFAULT_STOREFRONT_COVER_URL);
    assert.equal(resolveStorefrontCoverUrl(''), DEFAULT_STOREFRONT_COVER_URL);
    assert.equal(resolveStorefrontCoverUrl('   '), DEFAULT_STOREFRONT_COVER_URL);
  });

  it('keeps uploaded relative storage refs', () => {
    const url = '/storage/v1/object/public/menu-images/r1/storefront/cover-a.jpg';
    assert.equal(resolveStorefrontCoverUrl(url), url);
  });
});
