import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillSplit, Order } from '@/types';
import { buildSplitPersonReceiptLines, enqueueReceiptPrint } from './order-receipt-enqueue';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function byItemSplit(overrides: Partial<BillSplit> = {}): BillSplit {
  return {
    id: 'split-1',
    restaurant_id: 'rest-1',
    session_id: 'sess-1',
    table_id: 'table-1',
    display_name: 'A-01',
    order_ids: [ORDER_ID],
    split_mode: 'by_item',
    persons: [
      { name: 'Guest 1', items: [`${ORDER_ID}-0`] },
      { name: 'Guest 2', items: [`${ORDER_ID}-0`] },
      { name: 'Guest 3', items: [`${ORDER_ID}-0`] },
    ],
    result: [
      { name: 'Guest 1', amount: 1 },
      { name: 'Guest 2', amount: 1 },
      { name: 'Guest 3', amount: 1 },
    ],
    total_amount: 3,
    status: 'requested',
    created_at: '2026-06-22T00:00:00.000Z',
    ...overrides,
  };
}

const orders: Order[] = [
  {
    id: ORDER_ID,
    restaurant_id: 'rest-1',
    table_id: 'table-1',
    display_name: 'A-01',
    session_id: 'sess-1',
    status: 'done',
    total_amount: 3,
    created_at: '2026-06-22T00:00:00.000Z',
    updated_at: '2026-06-22T00:00:00.000Z',
    items: [
      {
        id: 'menu-coke',
        name: 'Coke',
        name_pt: 'Coca-Cola',
        qty: 1,
        price: 3,
        emoji: '🥤',
      },
    ],
  },
];

describe('buildSplitPersonReceiptLines', () => {
  it('includes 1/3 share label and per-person price for shared dish', () => {
    const lines = buildSplitPersonReceiptLines(byItemSplit(), 0, orders);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.display_name, 'Coca-Cola');
    assert.equal(lines[0]?.share_qty_label, '1/3');
    assert.equal(lines[0]?.unit_price, 1);
    assert.equal(lines[0]?.qty, 1);
  });

  it('shows full qty when dish is not shared', () => {
    const split = byItemSplit({
      persons: [{ name: 'Guest 1', items: [`${ORDER_ID}-0`] }],
      result: [{ name: 'Guest 1', amount: 3 }],
    });
    const lines = buildSplitPersonReceiptLines(split, 0, orders);
    assert.equal(lines[0]?.share_qty_label, '1');
    assert.equal(lines[0]?.unit_price, 3);
  });

  it('returns empty for even split mode', () => {
    const lines = buildSplitPersonReceiptLines(
      byItemSplit({ split_mode: 'even', persons: [], result: [] }),
      0,
      orders,
    );
    assert.deepEqual(lines, []);
  });
});

describe('enqueueReceiptPrint', () => {
  it('skips automatic print job when bill_receipt_print is disabled', async () => {
    let insertCalled = false;
    const admin = {
      from(table: string) {
        if (table === 'restaurants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { feature_flags: { bill_receipt_print: false } },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'print_jobs') {
          return {
            insert: () => {
              insertCalled = true;
              return { select: () => ({ single: async () => ({ data: null, error: null }) }) };
            },
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    const result = await enqueueReceiptPrint({
      admin,
      restaurantId: RESTAURANT_ID,
      printLocale: 'pt',
      sessionId: 'sess-1',
      tableId: 'table-1',
      tableDisplayName: 'A-01',
      variant: 'pre_bill',
    });

    assert.deepEqual(result, { ok: true, skipped: true });
    assert.equal(insertCalled, false);
  });

  it('checkout_bill uses discounted payable as amount_due', async () => {
    let insertedPayload: Record<string, unknown> | null = null;
    const billSplit: BillSplit = {
      id: 'split-checkout',
      restaurant_id: RESTAURANT_ID,
      session_id: 'sess-1',
      table_id: 'table-1',
      display_name: 'A-01',
      order_ids: [ORDER_ID],
      split_mode: 'even',
      persons: [],
      result: [{ name: 'Total', amount: 100 }],
      total_amount: 100,
      status: 'requested',
      created_at: '2026-06-22T00:00:00.000Z',
    };

    const admin = {
      from(table: string) {
        if (table === 'restaurants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { feature_flags: { bill_receipt_print: true } },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'bill_splits') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: billSplit, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'orders') {
          const ordersChain: {
            select: () => typeof ordersChain;
            eq: () => typeof ordersChain;
            in: () => typeof ordersChain;
            order: () => Promise<{ data: typeof orders; error: null }>;
          } = {
            select: () => ordersChain,
            eq: () => ordersChain,
            in: () => ordersChain,
            order: async () => ({ data: orders, error: null }),
          };
          return ordersChain;
        }
        if (table === 'menu_items') {
          return {
            select: () => ({
              eq: () => ({
                in: async () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'print_jobs') {
          return {
            insert: (row: { payload: Record<string, unknown> }) => {
              insertedPayload = row.payload;
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'job-1' }, error: null }),
                }),
              };
            },
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    const result = await enqueueReceiptPrint({
      admin,
      restaurantId: RESTAURANT_ID,
      printLocale: 'pt',
      sessionId: 'sess-1',
      tableId: 'table-1',
      tableDisplayName: 'A-01',
      variant: 'checkout_bill',
      billSplitId: billSplit.id,
      discountRate: 10,
    });

    assert.equal(result.ok, true);
    assert.equal(insertedPayload?.receipt_variant, 'checkout_bill');
    assert.equal(insertedPayload?.amount_due, 90);
    assert.equal(insertedPayload?.amount_paid, undefined);
  });

  it('enqueues checkout_bill when bill_receipt_print is disabled (manual staff print)', async () => {
    let insertCalled = false;
    const billSplit: BillSplit = {
      id: 'split-manual',
      restaurant_id: RESTAURANT_ID,
      session_id: 'sess-1',
      table_id: 'table-1',
      display_name: 'A-01',
      order_ids: [ORDER_ID],
      split_mode: 'even',
      persons: [],
      result: [{ name: 'Total', amount: 50 }],
      total_amount: 50,
      status: 'requested',
      created_at: '2026-06-22T00:00:00.000Z',
    };

    const admin = {
      from(table: string) {
        if (table === 'restaurants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { feature_flags: { bill_receipt_print: false } },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'bill_splits') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: billSplit, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'orders') {
          const ordersChain: {
            select: () => typeof ordersChain;
            eq: () => typeof ordersChain;
            in: () => typeof ordersChain;
            order: () => Promise<{ data: typeof orders; error: null }>;
          } = {
            select: () => ordersChain,
            eq: () => ordersChain,
            in: () => ordersChain,
            order: async () => ({ data: orders, error: null }),
          };
          return ordersChain;
        }
        if (table === 'menu_items') {
          return {
            select: () => ({
              eq: () => ({
                in: async () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'print_jobs') {
          return {
            insert: () => {
              insertCalled = true;
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'job-manual' }, error: null }),
                }),
              };
            },
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    const result = await enqueueReceiptPrint({
      admin,
      restaurantId: RESTAURANT_ID,
      printLocale: 'pt',
      sessionId: 'sess-1',
      tableId: 'table-1',
      tableDisplayName: 'A-01',
      variant: 'checkout_bill',
      billSplitId: billSplit.id,
    });

    assert.equal(result.ok, true);
    assert.equal('job_id' in result && result.job_id, 'job-manual');
    assert.equal(insertCalled, true);
  });
});
