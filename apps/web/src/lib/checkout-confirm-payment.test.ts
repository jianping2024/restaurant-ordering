import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillSplit } from '@/types';
import {
  applyDiscountToRows,
  confirmBillSplitPayment,
  httpStatusForConfirmPaymentRpcCode,
  normalizeSplitRows,
} from './checkout-confirm-payment';
import { checkoutReceiptIdempotencyKey } from './order-receipt-enqueue';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const BILL_SPLIT_ID = '22222222-2222-4222-8222-222222222222';

function billSplit(overrides: Partial<BillSplit> = {}): BillSplit {
  return {
    id: BILL_SPLIT_ID,
    restaurant_id: RESTAURANT_ID,
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

function mockAdminRpc(
  data: unknown,
  rpcError: { message: string } | null = null,
): SupabaseClient {
  return {
    rpc: async () => ({ data, error: rpcError }),
  } as unknown as SupabaseClient;
}

describe('normalizeSplitRows', () => {
  it('returns result rows when present', () => {
    const rows = normalizeSplitRows(
      billSplit({
        result: [
          { name: '客人 1', amount: 10 },
          { name: '客人 2', amount: 20 },
        ],
      }),
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].amount, 10);
  });

  it('synthesizes Total row when result empty but total_amount > 0', () => {
    const rows = normalizeSplitRows(billSplit({ result: [], total_amount: 57.5 }));
    assert.deepEqual(rows, [{ name: 'Total', amount: 57.5 }]);
  });

  it('returns empty when no result and zero total', () => {
    assert.deepEqual(normalizeSplitRows(billSplit({ result: [], total_amount: 0 })), []);
  });
});

describe('applyDiscountToRows', () => {
  const base = [
    { name: 'A', amount: 100 },
    { name: 'B', amount: 50 },
  ];

  it('applies percent discount', () => {
    const out = applyDiscountToRows(base, 10);
    assert.equal(out[0].amount, 90);
    assert.equal(out[1].amount, 45);
  });

  it('clamps rate to 0–100', () => {
    assert.equal(applyDiscountToRows(base, -5)[0].amount, 100);
    assert.equal(applyDiscountToRows(base, 150)[0].amount, 0);
  });

  it('preserves paid flag and name', () => {
    const out = applyDiscountToRows([{ name: 'X', amount: 40, paid: true }], 25);
    assert.equal(out[0].name, 'X');
    assert.equal(out[0].paid, true);
    assert.equal(out[0].amount, 30);
  });
});

describe('httpStatusForConfirmPaymentRpcCode', () => {
  it('maps known RPC codes', () => {
    assert.equal(httpStatusForConfirmPaymentRpcCode('bill_split_not_found'), 404);
    assert.equal(httpStatusForConfirmPaymentRpcCode('empty_split'), 400);
    assert.equal(httpStatusForConfirmPaymentRpcCode('invalid_person_index'), 400);
    assert.equal(httpStatusForConfirmPaymentRpcCode('already_paid'), 409);
    assert.equal(httpStatusForConfirmPaymentRpcCode('session_close_failed'), 500);
  });

  it('defaults unknown codes to 500', () => {
    assert.equal(httpStatusForConfirmPaymentRpcCode('unknown'), 500);
  });
});

describe('checkoutReceiptIdempotencyKey', () => {
  it('builds split and final keys', () => {
    assert.equal(
      checkoutReceiptIdempotencyKey('split_payment', BILL_SPLIT_ID, 1),
      `checkout:${BILL_SPLIT_ID}:split:1`,
    );
    assert.equal(
      checkoutReceiptIdempotencyKey('split_payment', BILL_SPLIT_ID, 1, 'pay-2'),
      `checkout:${BILL_SPLIT_ID}:split:1:payment:pay-2`,
    );
    assert.equal(
      checkoutReceiptIdempotencyKey('final', BILL_SPLIT_ID),
      `checkout:${BILL_SPLIT_ID}:final`,
    );
  });

  it('returns undefined for pre_bill and checkout_bill', () => {
    assert.equal(checkoutReceiptIdempotencyKey('pre_bill', BILL_SPLIT_ID), undefined);
    assert.equal(checkoutReceiptIdempotencyKey('checkout_bill', BILL_SPLIT_ID), undefined);
  });
});

describe('confirmBillSplitPayment', () => {
  const baseParams = {
    restaurantId: RESTAURANT_ID,
    printLocale: 'pt' as const,
    billSplitId: BILL_SPLIT_ID,
    personIndex: 0,
  };

  it('maps RPC already_paid to 409', async () => {
    const r = await confirmBillSplitPayment({
      ...baseParams,
      admin: mockAdminRpc({ ok: false, code: 'already_paid' }),
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 409);
    assert.equal(r.code, 'already_paid');
  });

  it('maps RPC bill_split_not_found to 404', async () => {
    const r = await confirmBillSplitPayment({
      ...baseParams,
      admin: mockAdminRpc({ ok: false, code: 'bill_split_not_found' }),
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 404);
  });

  it('maps transport rpc error to bill_update_failed 500', async () => {
    const r = await confirmBillSplitPayment({
      ...baseParams,
      admin: mockAdminRpc(null, { message: 'network' }),
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 500);
    assert.equal(r.code, 'bill_update_failed');
  });

  it('returns success payload from RPC without printing when flags false', async () => {
    const r = await confirmBillSplitPayment({
      ...baseParams,
      admin: mockAdminRpc({
        ok: true,
        newly_paid: true,
        should_print_split: false,
        should_print_final: false,
        all_paid: false,
        result: [{ name: 'A', amount: 50, paid: true }],
        final_amount: 50,
        collected_payment_id: 'pay-1',
        confirmed_person_index: 0,
        row_name: 'A',
        row_amount: 50,
      }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.all_paid, false);
    assert.equal(r.final_amount, 50);
    assert.equal(r.result[0]?.paid, true);
    assert.equal(r.collection?.id, 'pay-1');
    assert.equal(r.collection?.person_index, 0);
    assert.equal(r.collection?.amount, 50);
  });
});
