import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillSplit, Order } from '@/types';
import {
  buildReceiptLinesFromOrders,
  buildSplitPersonReceiptLines,
  enqueueReceiptPrint,
} from './order-receipt-enqueue';

type VatQueryChain = {
  select: () => VatQueryChain;
  eq: () => VatQueryChain;
  in: () => Promise<{ data: Array<{ id: string; vat_rate: number }>; error: null }>;
};

function vatQueryChain(rows: Array<{ id: string; vat_rate: number }>): VatQueryChain {
  const chain: VatQueryChain = {
    select: () => chain,
    eq: () => chain,
    in: async () => ({ data: rows, error: null }),
  };
  return chain;
}

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const CASHIER_STATION_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

/** Empty agent routing — resolveReceiptPrinterId returns undefined (sole enqueue path). */
function emptyPrintAgentDevicesTable() {
  return {
    select: () => ({
      eq: () => ({
        is: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    }),
  };
}

function mappedPrintAgentDevicesTable(stationId: string) {
  return {
    select: () => ({
      eq: () => ({
        is: () => ({
          order: () => ({
            limit: async () => ({
              data: [
                {
                  routing_snapshot: {
                    receipt_printers: [
                      {
                        id: `station:${stationId}`,
                        label: 'Cashier',
                        role: 'station',
                      },
                    ],
                    updated_at: '2026-08-03T00:00:00.000Z',
                  },
                  paired_at: '2026-08-03T00:00:00.000Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    }),
  };
}

const MENU_KEY = 'menu-coke::3';

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
      { name: 'Guest 1', items: [MENU_KEY] },
      { name: 'Guest 2', items: [MENU_KEY] },
      { name: 'Guest 3', items: [MENU_KEY] },
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
        item_code: '028',
        category_code_path: ['RE'],
      },
    ],
  },
];

describe('buildReceiptLinesFromOrders', () => {
  it('omits €0 free menu rows from receipt lines', () => {
    const mixed: Order[] = [
      {
        ...orders[0]!,
        items: [
          {
            id: 'menu-coke',
            name: 'Coke',
            name_pt: 'Coca-Cola',
            qty: 1,
            price: 3,
            emoji: '🥤',
            item_code: '028',
            category_code_path: ['RE'],
          },
          {
            id: 'menu-free',
            name: 'Free sushi',
            name_pt: 'Free sushi',
            qty: 2,
            price: 0,
            emoji: '🍣',
            item_code: '200',
            category_code_path: ['SU'],
          },
        ],
      },
    ];
    const lines = buildReceiptLinesFromOrders(
      mixed,
      'pt',
      { 'menu-coke': 23, 'menu-free': 13 },
      {},
    );
    assert.ok(!('error' in lines));
    if ('error' in lines) return;
    assert.equal(lines.length, 1);
    assert.match(lines[0]!.display_name, /Coca-Cola|Coke|028/);
    assert.equal(lines[0]!.unit_price, 3);
  });

  it('uses order snapshot codes with buffet lines mixed in', () => {
    const mixed: Order[] = [
      {
        ...orders[0]!,
        items: [
          {
            id: 'buffet:f5c81888-7b78-40da-ba60-519e185e48d6',
            kind: 'buffet_base',
            name: 'Buffet livre',
            name_pt: 'Buffet livre',
            qty: 1,
            price: 127.7,
            emoji: '🍽️',
            adult_count: 4,
            child_count: 2,
          },
          {
            id: '47cd765c-1443-454a-bd75-e73638c310f5',
            name_pt: 'Água 500ml',
            name: 'Água 500ml',
            qty: 1,
            price: 1.85,
            emoji: '💧',
            item_code: '001',
            category_code_path: ['RE'],
          },
        ],
      },
    ];
    const buffetId = 'f5c81888-7b78-40da-ba60-519e185e48d6';
    const lines = buildReceiptLinesFromOrders(
      mixed,
      'pt',
      { '47cd765c-1443-454a-bd75-e73638c310f5': 23 },
      { [buffetId]: 13 },
    );
    assert.ok(!('error' in lines));
    if ('error' in lines) return;
    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.display_name, 'Buffet livre');
    assert.equal(lines[0]?.share_qty_label, 'A4-C2');
    assert.equal(lines[0]?.vat_rate, '13.00');
    assert.equal(lines[1]?.display_name, '001-Água 500ml');
  });

  it('merges same menu item across orders regardless of note', () => {
    const cokeItem = {
      id: 'menu-coke',
      name: 'Cola',
      name_pt: 'Cola',
      qty: 1,
      price: 2.5,
      emoji: '🥤',
      item_code: '006',
      category_code_path: ['RE'],
    };
    const mergedOrders: Order[] = [
      {
        ...orders[0]!,
        id: 'order-a',
        items: [{ ...cokeItem, qty: 2, note: 'sem gelo' }],
      },
      {
        ...orders[0]!,
        id: 'order-b',
        items: [{ ...cokeItem, qty: 1, note: 'com limao' }],
      },
    ];
    const lines = buildReceiptLinesFromOrders(mergedOrders, 'pt', { 'menu-coke': 23 }, {});
    assert.ok(!('error' in lines));
    if ('error' in lines) return;
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.qty, 3);
    assert.equal(lines[0]?.unit_price, 2.5);
    assert.equal(lines[0]?.note, undefined);
  });
});

describe('buildSplitPersonReceiptLines', () => {
  it('includes 1/3 share label and per-person price for shared dish', () => {
    const lines = buildSplitPersonReceiptLines(
      byItemSplit(),
      0,
      orders,
      'pt',
      { 'menu-coke': 23 },
      {},
    );
    assert.ok(!('error' in lines));
    if ('error' in lines) return;
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.display_name, '028-Coca-Cola');
    assert.equal(lines[0]?.share_qty_label, '1/3');
    assert.equal(lines[0]?.unit_price, 1);
    assert.equal(lines[0]?.qty, 1);
  });

  it('shows full qty when dish is not shared', () => {
    const split = byItemSplit({
      persons: [{ name: 'Guest 1', items: [MENU_KEY] }],
      result: [{ name: 'Guest 1', amount: 3 }],
    });
    const lines = buildSplitPersonReceiptLines(split, 0, orders, 'pt', { 'menu-coke': 23 }, {});
    assert.ok(!('error' in lines));
    if ('error' in lines) return;
    assert.equal(lines[0]?.share_qty_label, '1');
    assert.equal(lines[0]?.unit_price, 3);
  });

  it('returns empty for even split mode', () => {
    const lines = buildSplitPersonReceiptLines(
      byItemSplit({ split_mode: 'even', persons: [], result: [] }),
      0,
      orders,
      'pt',
      { 'menu-coke': 23 },
      {},
    );
    assert.ok(!('error' in lines));
    if ('error' in lines) return;
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
        
        if (table === 'menu_items') {
          return vatQueryChain([{ id: 'menu-coke', vat_rate: 23 }, { id: '47cd765c-1443-454a-bd75-e73638c310f5', vat_rate: 23 }]);
        }
        if (table === 'buffets') {
          return vatQueryChain([{ id: 'f5c81888-7b78-40da-ba60-519e185e48d6', vat_rate: 13 }]);
        }
        if (table === 'print_agent_devices') {
          return emptyPrintAgentDevicesTable();
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

  it('enqueues staff_manual pre_bill when bill_receipt_print is disabled', async () => {
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
        if (table === 'print_jobs') {
          return {
            insert: (row: { type: string }) => {
              insertCalled = true;
              assert.equal(row.type, 'pre_bill');
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'job-pre-manual' }, error: null }),
                }),
              };
            },
          };
        }
        
        if (table === 'menu_items') {
          return vatQueryChain([{ id: 'menu-coke', vat_rate: 23 }, { id: '47cd765c-1443-454a-bd75-e73638c310f5', vat_rate: 23 }]);
        }
        if (table === 'buffets') {
          return vatQueryChain([{ id: 'f5c81888-7b78-40da-ba60-519e185e48d6', vat_rate: 13 }]);
        }
        if (table === 'print_agent_devices') {
          return emptyPrintAgentDevicesTable();
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
      printSource: 'staff_manual',
    });

    assert.equal(result.ok, true);
    assert.equal('job_id' in result && result.job_id, 'job-pre-manual');
    assert.equal(insertCalled, true);
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
        
        if (table === 'menu_items') {
          return vatQueryChain([{ id: 'menu-coke', vat_rate: 23 }, { id: '47cd765c-1443-454a-bd75-e73638c310f5', vat_rate: 23 }]);
        }
        if (table === 'buffets') {
          return vatQueryChain([{ id: 'f5c81888-7b78-40da-ba60-519e185e48d6', vat_rate: 13 }]);
        }
        if (table === 'print_agent_devices') {
          return emptyPrintAgentDevicesTable();
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
    const payloadLines = insertedPayload?.lines as Array<{ display_name: string }>;
    assert.equal(payloadLines[0]?.display_name, '028-Coca-Cola');
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
        
        if (table === 'menu_items') {
          return vatQueryChain([{ id: 'menu-coke', vat_rate: 23 }, { id: '47cd765c-1443-454a-bd75-e73638c310f5', vat_rate: 23 }]);
        }
        if (table === 'buffets') {
          return vatQueryChain([{ id: 'f5c81888-7b78-40da-ba60-519e185e48d6', vat_rate: 13 }]);
        }
        if (table === 'print_agent_devices') {
          return emptyPrintAgentDevicesTable();
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
      printSource: 'staff_manual',
    });

    assert.equal(result.ok, true);
    assert.equal('job_id' in result && result.job_id, 'job-manual');
    assert.equal(insertCalled, true);
  });

  it('enqueues staff_manual split_payment when bill_receipt_print is disabled', async () => {
    let insertCalled = false;
    const billSplit = byItemSplit();

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
        if (table === 'print_jobs') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    eq: () => ({
                      order: () => ({
                        limit: () => ({
                          maybeSingle: async () => ({ data: null, error: null }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
            insert: () => {
              insertCalled = true;
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'job-split-manual' }, error: null }),
                }),
              };
            },
          };
        }
        
        if (table === 'menu_items') {
          return vatQueryChain([{ id: 'menu-coke', vat_rate: 23 }, { id: '47cd765c-1443-454a-bd75-e73638c310f5', vat_rate: 23 }]);
        }
        if (table === 'buffets') {
          return vatQueryChain([{ id: 'f5c81888-7b78-40da-ba60-519e185e48d6', vat_rate: 13 }]);
        }
        if (table === 'print_agent_devices') {
          return emptyPrintAgentDevicesTable();
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
      variant: 'split_payment',
      billSplitId: billSplit.id,
      personIndex: 0,
      personAmount: 1,
      amountPaid: 1,
      paymentMethod: 'Cash',
      collectedPaymentId: 'pay-1',
      printSource: 'staff_manual',
    });

    assert.equal(result.ok, true);
    assert.equal('job_id' in result && result.job_id, 'job-split-manual');
    assert.equal(insertCalled, true);
  });

  it('checkout_bill without bill_split uses merged line subtotal as amount_due', async () => {
    let insertedPayload: Record<string, unknown> | null = null;
    const duplicateOrders: Order[] = [
      {
        ...orders[0]!,
        id: 'order-a',
        items: [{ ...orders[0]!.items[0]!, qty: 1 }],
      },
      {
        ...orders[0]!,
        id: 'order-b',
        items: [{ ...orders[0]!.items[0]!, qty: 2 }],
      },
    ];

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
        if (table === 'orders') {
          const ordersChain: {
            select: () => typeof ordersChain;
            eq: () => typeof ordersChain;
            in: () => typeof ordersChain;
            order: () => Promise<{ data: typeof duplicateOrders; error: null }>;
          } = {
            select: () => ordersChain,
            eq: () => ordersChain,
            in: () => ordersChain,
            order: async () => ({ data: duplicateOrders, error: null }),
          };
          return ordersChain;
        }
        if (table === 'print_jobs') {
          return {
            insert: (row: { payload: Record<string, unknown> }) => {
              insertedPayload = row.payload;
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'job-session' }, error: null }),
                }),
              };
            },
          };
        }
        
        if (table === 'menu_items') {
          return vatQueryChain([{ id: 'menu-coke', vat_rate: 23 }, { id: '47cd765c-1443-454a-bd75-e73638c310f5', vat_rate: 23 }]);
        }
        if (table === 'buffets') {
          return vatQueryChain([{ id: 'f5c81888-7b78-40da-ba60-519e185e48d6', vat_rate: 13 }]);
        }
        if (table === 'print_agent_devices') {
          return emptyPrintAgentDevicesTable();
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
    });

    assert.equal(result.ok, true);
    assert.equal(insertedPayload?.amount_due, 9);
    const payloadLines = insertedPayload?.lines as Array<{ qty: number }>;
    assert.equal(payloadLines.length, 1);
    assert.equal(payloadLines[0]?.qty, 3);
  });

  it('stamps Dashboard default_receipt_station_id when caller omits printer', async () => {
    let insertedPayload: Record<string, unknown> | null = null;
    const admin = {
      from(table: string) {
        if (table === 'restaurants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    feature_flags: { bill_receipt_print: true },
                    print_agent_config: {
                      default_receipt_station_id: `station:${CASHIER_STATION_ID}`,
                    },
                  },
                  error: null,
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
        if (table === 'print_jobs') {
          return {
            insert: (row: { payload: Record<string, unknown> }) => {
              insertedPayload = row.payload;
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'job-default-printer' }, error: null }),
                }),
              };
            },
          };
        }
        if (table === 'menu_items') {
          return vatQueryChain([
            { id: 'menu-coke', vat_rate: 23 },
            { id: '47cd765c-1443-454a-bd75-e73638c310f5', vat_rate: 23 },
          ]);
        }
        if (table === 'buffets') {
          return vatQueryChain([{ id: 'f5c81888-7b78-40da-ba60-519e185e48d6', vat_rate: 13 }]);
        }
        if (table === 'print_agent_devices') {
          return mappedPrintAgentDevicesTable(CASHIER_STATION_ID);
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
      printSource: 'staff_manual',
    });

    assert.equal(result.ok, true);
    assert.equal(insertedPayload?.receipt_printer_id, `station:${CASHIER_STATION_ID}`);
  });

  it('rejects invalid explicit receipt_printer_id', async () => {
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
          return vatQueryChain([
            { id: 'menu-coke', vat_rate: 23 },
            { id: '47cd765c-1443-454a-bd75-e73638c310f5', vat_rate: 23 },
          ]);
        }
        if (table === 'buffets') {
          return vatQueryChain([{ id: 'f5c81888-7b78-40da-ba60-519e185e48d6', vat_rate: 13 }]);
        }
        if (table === 'print_agent_devices') {
          return mappedPrintAgentDevicesTable(CASHIER_STATION_ID);
        }
        if (table === 'print_jobs') {
          throw new Error('print_jobs must not insert on invalid printer');
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
      printSource: 'staff_manual',
      receiptPrinterId: 'station:99999999-9999-4999-8999-999999999999',
    });

    assert.deepEqual(result, {
      ok: false,
      status: 400,
      code: 'invalid_receipt_printer',
    });
  });
});
