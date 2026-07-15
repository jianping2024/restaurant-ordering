import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { guestOrderingEnabled, isTableSessionOpen } from '@/lib/guest-table-ordering';

describe('isTableSessionOpen', () => {
  it('is true only for open sessions', () => {
    assert.equal(isTableSessionOpen(null), false);
    assert.equal(isTableSessionOpen({ status: 'billing' }), false);
    assert.equal(isTableSessionOpen({ status: 'open' }), true);
  });
});

describe('guestOrderingEnabled', () => {
  it('is false without open session', () => {
    assert.equal(guestOrderingEnabled(null), false);
    assert.equal(guestOrderingEnabled({ status: 'billing' }), false);
  });

  it('is true on open session even before buffet is posted', () => {
    assert.equal(guestOrderingEnabled({ status: 'open' }), true);
  });
});
