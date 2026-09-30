import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mintPaidPeerFloatBaselineAtMs,
  parsePeerFloatAddedAtMs,
  peerFloatPaidItemKey,
  shouldEmitPaidPeerFloatAfterBaseline,
} from '@/lib/table-order-round/sushi-peer-float-baseline';

describe('sushi-peer-float-baseline', () => {
  it('builds a stable paid seen key', () => {
    assert.equal(
      peerFloatPaidItemKey({
        orderId: 'o1',
        batchId: 'b1',
        lineId: 'l1',
        addedAt: '2026-01-01T00:00:00.000Z',
      }),
      'o1:b1:l1:2026-01-01T00:00:00.000Z',
    );
    assert.equal(
      peerFloatPaidItemKey({
        orderId: 'o1',
        batchId: null,
        lineId: 'l1',
        addedAt: undefined,
      }),
      'o1:nobatch:l1:',
    );
  });

  it('parses added_at and rejects missing/invalid', () => {
    assert.equal(parsePeerFloatAddedAtMs('2026-01-01T00:00:00.000Z'), Date.parse('2026-01-01T00:00:00.000Z'));
    assert.equal(parsePeerFloatAddedAtMs(undefined), null);
    assert.equal(parsePeerFloatAddedAtMs(''), null);
    assert.equal(parsePeerFloatAddedAtMs('not-a-date'), null);
  });

  it('floats only when added_at is strictly after paid baseline', () => {
    const baseline = mintPaidPeerFloatBaselineAtMs(1_000_000);
    assert.equal(shouldEmitPaidPeerFloatAfterBaseline(1_000_001, baseline), true);
    assert.equal(shouldEmitPaidPeerFloatAfterBaseline(1_000_000, baseline), false);
    assert.equal(shouldEmitPaidPeerFloatAfterBaseline(999_999, baseline), false);
    assert.equal(shouldEmitPaidPeerFloatAfterBaseline(null, baseline), false);
  });
});
