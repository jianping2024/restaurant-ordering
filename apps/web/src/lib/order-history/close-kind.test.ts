import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isOperationalSourceCloseKind,
  isTransferredSourceCloseKind,
  resolveOrderHistoryCloseKind,
} from '@/lib/order-history/close-kind';
import { MERGED_CLOSE_REASON } from '@/lib/order-history/close-kind';

describe('close-kind', () => {
  it('recognizes merged close reason', () => {
    assert.equal(resolveOrderHistoryCloseKind(MERGED_CLOSE_REASON), 'merged_source');
    assert.equal(resolveOrderHistoryCloseKind('frontdesk_closed'), 'billing');
  });

  it('classifies operational source close kinds', () => {
    assert.equal(isOperationalSourceCloseKind('merged_source'), true);
    assert.equal(isOperationalSourceCloseKind('transferred_source'), true);
    assert.equal(isOperationalSourceCloseKind('billing'), false);
    assert.equal(isTransferredSourceCloseKind('transferred_source'), true);
  });
});
