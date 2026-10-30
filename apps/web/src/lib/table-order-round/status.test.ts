import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { guestClientSeatLimit } from '@/lib/table-order-round/status';

describe('guestClientSeatLimit', () => {
  it('leaves room for re-scans: max(n+2, 2n)', () => {
    assert.equal(guestClientSeatLimit(1), 3);
    assert.equal(guestClientSeatLimit(2), 4);
    assert.equal(guestClientSeatLimit(3), 6);
    assert.equal(guestClientSeatLimit(10), 20);
  });

  it('floors fractional headcount', () => {
    assert.equal(guestClientSeatLimit(2.9), 4);
  });

  it('returns 0 (no cap) when headcount is unknown', () => {
    assert.equal(guestClientSeatLimit(0), 0);
    assert.equal(guestClientSeatLimit(-1), 0);
    assert.equal(guestClientSeatLimit(Number.NaN), 0);
  });
});
