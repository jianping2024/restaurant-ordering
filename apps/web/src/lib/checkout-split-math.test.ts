import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit } from '@/types';
import {
  applyDiscountToRows,
  checkoutPayableAmount,
  clampCheckoutDiscountRate,
  normalizeSplitRows,
} from './checkout-split-math';

const BILL_SPLIT_ID = '22222222-2222-4222-8222-222222222222';

function billSplit(overrides: Partial<BillSplit> = {}): BillSplit {
  return {
    id: BILL_SPLIT_ID,
    restaurant_id: '11111111-1111-4111-8111-111111111111',
    order_ids: [],
    split_mode: 'even',
    persons: [],
    result: [],
    total_amount: 0,
    status: 'requested',
    created_at: '2026-05-29T00:00:00.000Z',
    session_id: null,
    table_id: '33333333-3333-4333-8333-333333333333',
    display_name: 'A-01',
    ...overrides,
  };
}

describe('checkout-split-math', () => {
  it('normalizeSplitRows synthesizes Total when result empty', () => {
    assert.deepEqual(normalizeSplitRows(billSplit({ total_amount: 57.5 })), [
      { name: 'Total', amount: 57.5 },
    ]);
  });

  it('checkoutPayableAmount applies discount to split total', () => {
    const split = billSplit({ total_amount: 100, result: [{ name: 'Total', amount: 100 }] });
    assert.equal(checkoutPayableAmount(split, 10), 90);
    assert.equal(checkoutPayableAmount(split, 0), 100);
  });

  it('clampCheckoutDiscountRate bounds rate', () => {
    assert.equal(clampCheckoutDiscountRate(-5), 0);
    assert.equal(clampCheckoutDiscountRate(150), 100);
  });

  it('applyDiscountToRows preserves paid flag', () => {
    const out = applyDiscountToRows([{ name: 'X', amount: 40, paid: true }], 25);
    assert.equal(out[0]?.paid, true);
    assert.equal(out[0]?.amount, 30);
  });
});
