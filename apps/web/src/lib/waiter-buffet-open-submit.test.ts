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
    assert.equal(
      buffetOpenSubmitBlockReason([], { b1: { adults: 0, children: 0 } }, ['b1'], true, false),
      null,
    );
  });

  it('blocks unchanged snapshot when session already open', () => {
    assert.equal(
      buffetOpenSubmitBlockReason([buffetOrder], { b1: { adults: 2, children: 0 } }, ['b1'], true, true),
      'unchanged',
    );
  });

  it('allows changed snapshot when editor is ready', () => {
    assert.equal(
      buffetOpenSubmitBlockReason([], { b1: { adults: 2, children: 0 } }, ['b1'], true, false),
      null,
    );
  });

  it('blocks when editor is not ready', () => {
    assert.equal(
      buffetOpenSubmitBlockReason([], { b1: { adults: 2, children: 0 } }, ['b1'], false, false),
      'editor_not_ready',
    );
  });

  it('blocks repeat zero-guest submit after session-only open', () => {
    assert.equal(
      buffetOpenSubmitBlockReason([], { b1: { adults: 0, children: 0 } }, ['b1'], true, true),
      'unchanged',
    );
  });
});
