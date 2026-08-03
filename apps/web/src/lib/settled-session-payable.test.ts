import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSettledSessionPayable, resolveSettledSessionPayableForRevenue } from './settled-session-payable';
import type { Order } from '@/types';

describe('resolveSettledSessionPayable', () => {
  it('prefers snapshot over order derivation', () => {
    assert.equal(
      resolveSettledSessionPayable({
        settledPayableAmount: 12.5,
        orders: [],
      }),
      12.5,
    );
  });

  it('derives billable total when snapshot missing', () => {
    const orders: Order[] = [
      {
        id: 'o1',
        restaurant_id: 'r',
        table_id: 't',
        display_name: '1',
        status: 'done',
        total_amount: 99,
        created_at: '',
        updated_at: '',
        items: [{ id: 'm1', name: 'Tea', name_pt: 'Cha', qty: 1, price: 3 }],
      },
    ];
    assert.equal(resolveSettledSessionPayable({ orders }), 3);
  });
});

describe('resolveSettledSessionPayableForRevenue', () => {
  it('uses snapshot when present', () => {
    assert.equal(
      resolveSettledSessionPayableForRevenue({
        settledPayableAmount: 8,
        orderTotalAmountSum: 40,
      }),
      8,
    );
  });

  it('falls back to order total sum for legacy rows', () => {
    assert.equal(
      resolveSettledSessionPayableForRevenue({
        settledPayableAmount: null,
        orderTotalAmountSum: 40,
      }),
      40,
    );
  });
});
