import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  guestBillSplitModeFromSplit,
  guestBillSplitModeLocked,
  guestTablePlanHoldsCheckout,
  resolveGuestBillSplitMode,
} from './guest-bill-split-mode';
import type { BillSplit } from '../types';

function split(partial: Partial<BillSplit>): BillSplit {
  return {
    id: 's1',
    restaurant_id: 'r1',
    session_id: 'sess',
    table_id: 't1',
    display_name: 'A1',
    order_ids: [],
    split_mode: 'whole_table',
    persons: [],
    result: [],
    total_amount: 10,
    status: 'pending',
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('guestBillSplitModeLocked', () => {
  it('locks after collection', () => {
    assert.equal(guestBillSplitModeLocked(null, 1), true);
  });

  it('locks by-item once persons exist', () => {
    assert.equal(
      guestBillSplitModeLocked(
        split({
          split_mode: 'by_item',
          persons: [{ name: 'A', party_id: 'p1', item_shares: [] }],
          status: 'confirmed',
        }),
        0,
      ),
      true,
    );
  });

  it('locks whole_table once requested', () => {
    assert.equal(
      guestBillSplitModeLocked(split({ status: 'requested' }), 0),
      true,
    );
  });
});

describe('resolveGuestBillSplitMode', () => {
  it('defaults to draft whole_table when open', () => {
    assert.deepEqual(
      resolveGuestBillSplitMode({
        draft: 'whole_table',
        existingSplit: null,
        collectedPaymentCount: 0,
      }),
      { mode: 'whole_table', locked: false },
    );
  });

  it('hydrates locked mode from server', () => {
    assert.deepEqual(
      resolveGuestBillSplitMode({
        draft: 'whole_table',
        existingSplit: split({
          split_mode: 'even',
          result: [{ name: 'A', amount: 5 }],
          status: 'requested',
        }),
        collectedPaymentCount: 0,
      }),
      { mode: 'even', locked: true },
    );
  });
});

describe('guestTablePlanHoldsCheckout', () => {
  it('ignores by-item plans', () => {
    assert.equal(
      guestTablePlanHoldsCheckout(split({ split_mode: 'by_item', status: 'requested' })),
      false,
    );
  });

  it('treats requested whole_table as holding checkout', () => {
    assert.equal(
      guestTablePlanHoldsCheckout(split({ status: 'requested' })),
      true,
    );
  });
});

describe('guestBillSplitModeFromSplit', () => {
  it('maps modes', () => {
    assert.equal(guestBillSplitModeFromSplit(split({ split_mode: 'even' })), 'even');
    assert.equal(guestBillSplitModeFromSplit(split({ split_mode: 'by_item' })), 'by_item');
    assert.equal(guestBillSplitModeFromSplit(split({})), 'whole_table');
  });
});
