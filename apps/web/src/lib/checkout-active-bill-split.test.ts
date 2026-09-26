import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkoutPayloadFromBillSplit } from './checkout-active-bill-split';
import type { BillSplit } from '@/types';

describe('checkoutPayloadFromBillSplit', () => {
  it('builds reopen payload from an active by_item split', () => {
    const split = {
      split_mode: 'by_item',
      persons: [{ name: 'A', party_id: '11111111-1111-4111-8111-111111111111', item_shares: [] }],
      result: [{ name: 'A', amount: 12.5, party_id: '11111111-1111-4111-8111-111111111111', paid: true }],
      customer_nif: null,
    } as Pick<BillSplit, 'split_mode' | 'persons' | 'result' | 'customer_nif'>;

    assert.deepEqual(checkoutPayloadFromBillSplit(split), {
      splitMode: 'by_item',
      persons: split.persons,
      result: split.result,
      customerNif: null,
    });
  });

  it('returns null when mode or rows are missing', () => {
    assert.equal(
      checkoutPayloadFromBillSplit({
        split_mode: 'nope' as BillSplit['split_mode'],
        persons: [{ name: 'A' }],
        result: [{ name: 'A', amount: 1 }],
        customer_nif: null,
      }),
      null,
    );
    assert.equal(
      checkoutPayloadFromBillSplit({
        split_mode: 'whole_table',
        persons: [],
        result: [{ name: '__whole_table__', amount: 1 }],
        customer_nif: null,
      }),
      null,
    );
  });
});
