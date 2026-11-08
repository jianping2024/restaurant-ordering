import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buffetOpenSubmitBlockReason } from '@/lib/waiter-buffet-open-submit';

const buffetOrder = {
  id: 'order-1',
  status: 'done' as const,
  items: [
    {
      id: 'line-1',
      kind: 'buffet_base' as const,
      name: 'Buffet',
      name_pt: 'Buffet',
      qty: 1,
      price: 39.9,
      emoji: '🍽️',
      adult_count: 2,
      child_count: 0,
      buffet_id: 'b1',
      added_at: '2026-01-01T10:00:00.000Z',
    },
  ],
};

describe('buffetOpenSubmitBlockReason', () => {
  it('allows zero-guest first open when no session exists yet', () => {
    assert.deepEqual(
      buffetOpenSubmitBlockReason([], { buffetId: 'b1', adults: 0, children: 0 }, true, false, null),
      null,
    );
  });

  it('blocks unchanged buffet when session already open', () => {
    assert.deepEqual(
      buffetOpenSubmitBlockReason([buffetOrder], { buffetId: 'b1', adults: 2, children: 0 }, true, true, null),
      { code: 'unchanged' },
    );
  });

  it('allows changed buffet when editor is ready', () => {
    assert.deepEqual(
      buffetOpenSubmitBlockReason([], { buffetId: 'b1', adults: 2, children: 0 }, true, false, null),
      null,
    );
  });

  it('blocks when editor is not ready', () => {
    assert.deepEqual(
      buffetOpenSubmitBlockReason([], { buffetId: 'b1', adults: 2, children: 0 }, false, false, null),
      { code: 'editor_not_ready' },
    );
  });

  it('session without a buffet line: 0 + 0 still writes the package line (not unchanged)', () => {
    assert.deepEqual(
      buffetOpenSubmitBlockReason([], { buffetId: 'b1', adults: 0, children: 0 }, true, true, null),
      null,
    );
  });

  it('blocks by the shared headcount rule (minimum + disabled side)', () => {
    const minTwo = { minGuestCount: 2, adultEnabled: true, childEnabled: true };
    assert.deepEqual(
      buffetOpenSubmitBlockReason([], { buffetId: 'b1', adults: 1, children: 0 }, true, false, minTwo),
      { code: 'buffet_min_guest_count', min: 2, total: 1 },
    );
    // Untouched 0 + 0 cold open still hits the minimum (no session yet).
    assert.deepEqual(
      buffetOpenSubmitBlockReason([], { buffetId: 'b1', adults: 0, children: 0 }, true, false, minTwo),
      { code: 'buffet_min_guest_count', min: 2, total: 0 },
    );
    assert.deepEqual(
      buffetOpenSubmitBlockReason([], { buffetId: 'b1', adults: 2, children: 0 }, true, false, minTwo),
      null,
    );
    assert.deepEqual(
      buffetOpenSubmitBlockReason(
        [buffetOrder],
        { buffetId: 'b1', adults: 2, children: 1 },
        true,
        true,
        { minGuestCount: 0, adultEnabled: true, childEnabled: false },
      ),
      { code: 'buffet_side_disabled', side: 'children' },
    );
  });
});
