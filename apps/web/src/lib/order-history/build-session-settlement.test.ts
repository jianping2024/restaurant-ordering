import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildOperationalSourceSessionSettlement,
  buildOrderHistorySessionSettlement,
  resolveOrderHistoryCloseOutcome,
} from '@/lib/order-history/build-session-settlement';
import type { OrderHistoryBillSplitSummary } from '@/lib/order-history-bill-splits';
import type { Order } from '@/types';

const baseSplit: OrderHistoryBillSplitSummary = {
  id: 'split-1',
  session_id: 'session-1',
  table_id: 'table-1',
  discount_rate: 10,
  status: 'cancelled',
  total_amount: 100,
  split_mode: 'even',
  persons: [],
  result: [
    { name: 'Ana', amount: 50, paid: false },
    { name: 'Bob', amount: 50, paid: false },
  ],
};

const emptyOrders: Order[] = [];

const orderWithTotal: Order[] = [
  {
    id: 'o1',
    total_amount: 29.9,
    items: [{ id: 'd1', name: 'Dish', qty: 1, price: 29.9 }],
  },
] as Order[];

describe('resolveOrderHistoryCloseOutcome', () => {
  it('returns fully_paid when split is paid', () => {
    assert.equal(
      resolveOrderHistoryCloseOutcome({ ...baseSplit, status: 'paid' }, []),
      'fully_paid',
    );
  });

  it('returns fully_paid for settled closed_reason without ledger', () => {
    assert.equal(
      resolveOrderHistoryCloseOutcome(undefined, [], 'frontdesk_closed'),
      'fully_paid',
    );
    assert.equal(
      resolveOrderHistoryCloseOutcome(baseSplit, [], 'cashier_closed'),
      'fully_paid',
    );
  });

  it('returns partially_collected_closed when ledger has payments', () => {
    assert.equal(
      resolveOrderHistoryCloseOutcome(baseSplit, [
        {
          id: 'pay-1',
          person_name: 'Ana',
          amount: 25,
          created_at: '2026-07-05T04:00:00.000Z',
        },
      ]),
      'partially_collected_closed',
    );
  });

  it('returns unpaid_closed when cancelled split has no collections', () => {
    assert.equal(resolveOrderHistoryCloseOutcome(baseSplit, []), 'unpaid_closed');
  });

  it('returns closed_without_billing when no split and no payments', () => {
    assert.equal(resolveOrderHistoryCloseOutcome(undefined, []), 'closed_without_billing');
  });

  it('keeps auto_nightly without ledger as closed_without_billing', () => {
    assert.equal(
      resolveOrderHistoryCloseOutcome(undefined, [], 'auto_nightly'),
      'closed_without_billing',
    );
  });
});

describe('buildOrderHistorySessionSettlement', () => {
  it('suppresses void styling when collections exist', () => {
    const settlement = buildOrderHistorySessionSettlement({
      billSplit: baseSplit,
      collectedPayments: [
        {
          id: 'pay-1',
          person_name: 'Ana',
          amount: 20,
          created_at: '2026-07-05T04:00:00.000Z',
        },
      ],
      orders: emptyOrders,
    });

    assert.equal(settlement.outcome, 'partially_collected_closed');
    assert.equal(settlement.listAmountKind, 'collected');
    assert.equal(settlement.listAmount, 20);
    assert.equal(settlement.summary?.collected, 20);
    assert.equal(settlement.summary?.payable, 90);
    assert.equal(settlement.summary?.pending, 70);
  });

  it('keeps void styling for unpaid forced close', () => {
    const settlement = buildOrderHistorySessionSettlement({
      billSplit: baseSplit,
      collectedPayments: [],
      orders: emptyOrders,
    });

    assert.equal(settlement.outcome, 'unpaid_closed');
    assert.equal(settlement.listAmount, null);
    assert.equal(settlement.summary?.collected, 0);
  });

  it('treats settled close without ledger as fully paid from orders', () => {
    const settlement = buildOrderHistorySessionSettlement({
      collectedPayments: [],
      orders: orderWithTotal,
      closedReason: 'frontdesk_closed',
    });

    assert.equal(settlement.outcome, 'fully_paid');
    assert.equal(settlement.listAmountKind, 'paid');
    assert.equal(settlement.listAmount, 29.9);
    assert.equal(settlement.summary?.payable, 29.9);
    assert.equal(settlement.summary?.collected, 0);
    assert.equal(settlement.summary?.pending, 0);
    assert.equal(settlement.showFinancialDetails, false);
    assert.equal(settlement.canPrintBill, true);
  });

  it('denies bill print for auto_nightly even with order lines', () => {
    const settlement = buildOrderHistorySessionSettlement({
      collectedPayments: [],
      orders: orderWithTotal,
      closedReason: 'auto_nightly',
    });

    assert.equal(settlement.outcome, 'closed_without_billing');
    assert.equal(settlement.canPrintBill, false);
  });

  it('reconciles payable from order lines when split snapshot is zeroed', () => {
    const settlement = buildOrderHistorySessionSettlement({
      billSplit: {
        ...baseSplit,
        total_amount: 0,
        result: [],
      },
      collectedPayments: [
        {
          id: 'pay-1',
          person_name: 'Ana',
          amount: 20,
          created_at: '2026-07-05T04:00:00.000Z',
        },
      ],
      orders: [
        {
          id: 'o1',
          total_amount: 0,
          items: [
            {
              id: 'd1',
              name: 'Buffet',
              qty: 1,
              price: 100,
            },
          ],
        },
      ] as Order[],
    });

    assert.equal(settlement.showFinancialDetails, true);
    assert.equal(settlement.summary?.consumption, 100);
    assert.equal(settlement.summary?.payable, 90);
    assert.equal(settlement.summary?.collected, 20);
    assert.equal(settlement.summary?.pending, 70);
  });

  it('builds summary from ledger when split row is missing', () => {
    const settlement = buildOrderHistorySessionSettlement({
      collectedPayments: [
        {
          id: 'pay-1',
          person_name: 'Ana',
          amount: 15,
          created_at: '2026-07-05T04:00:00.000Z',
        },
      ],
      orders: [
        {
          id: 'o1',
          total_amount: 0,
          items: [{ id: 'd1', name: 'Water', qty: 2, price: 2.5 }],
        },
      ] as Order[],
    });

    assert.equal(settlement.outcome, 'partially_collected_closed');
    assert.equal(settlement.summary?.payable, 5);
    assert.equal(settlement.summary?.pending, 0);
  });

  it('returns zero-value settlement for merged source sessions', () => {
    const settlement = buildOperationalSourceSessionSettlement();
    assert.equal(settlement.outcome, 'closed_without_billing');
    assert.equal(settlement.canPrintBill, false);
    assert.equal(settlement.listAmount, null);
    assert.equal(settlement.showFinancialDetails, false);
  });
});
