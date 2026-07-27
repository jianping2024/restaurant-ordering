import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MERGED_CLOSE_REASON,
  isMergedCloseReason,
  normalizeMergeTargetStatus,
  resolveOrderHistoryCloseKind,
} from '@/lib/order-history/close-kind';

describe('close-kind', () => {
  it('detects merged close reason', () => {
    assert.equal(isMergedCloseReason(MERGED_CLOSE_REASON), true);
    assert.equal(isMergedCloseReason('frontdesk_closed'), false);
  });

  it('resolves close kind from closed_reason', () => {
    assert.equal(resolveOrderHistoryCloseKind(MERGED_CLOSE_REASON), 'merged_source');
    assert.equal(resolveOrderHistoryCloseKind('cashier_closed'), 'billing');
  });

  it('normalizes merge target status', () => {
    assert.equal(normalizeMergeTargetStatus('closed'), 'closed');
    assert.equal(normalizeMergeTargetStatus('billing'), 'billing');
    assert.equal(normalizeMergeTargetStatus('invalid'), 'unknown');
  });
});
