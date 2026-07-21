import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildOrderHistoryBillDetailView } from '@/lib/order-history/build-bill-detail-view';
import type { OrderHistoryEntry } from '@/lib/order-history/types';

const closedAt = '2026-07-05T12:00:00.000Z';

function baseEntry(overrides: Partial<OrderHistoryEntry>): OrderHistoryEntry {
  return {
    sessionId: 'sess-1',
    tableId: 'table-1',
    displayName: 'A-01',
    closedAt,
    openedByName: 'Staff',
    itemCount: 2,
    closeAnnotation: { isForcedUnpaidClose: false },
    orders: [],
    settlement: {
      outcome: 'fully_paid',
      summary: {
        consumption: 10,
        payable: 10,
        discountRate: 0,
        collected: 10,
        pending: 0,
      },
      showFinancialDetails: true,
      collectedPayments: [],
      listAmount: 10,
      listAmountKind: 'paid',
      paidRevenue: 10,
    },
    ...overrides,
  };
}

describe('buildOrderHistoryBillDetailView', () => {
  it('builds billable table lines and split rows for paid by_item sessions', () => {
    const entry = baseEntry({
      billSplit: {
        id: 'split-1',
        session_id: 'sess-1',
        table_id: 'table-1',
        discount_rate: 0,
        status: 'paid',
        total_amount: 10,
        split_mode: 'by_item',
        persons: [{ name: 'John', items: ['line-1'] }],
        result: [
          { name: 'John', amount: 6, paid: true },
          { name: 'Mike', amount: 4, paid: true },
        ],
      },
      orders: [
        {
          id: 'o1',
          items: [
            {
              id: 'line-1',
              name: 'Cola',
              name_pt: 'Cola',
              qty: 1,
              price: 10,
              emoji: '🥤',
              item_status: 'done',
            },
          ],
        },
      ] as OrderHistoryEntry['orders'],
    });

    const view = buildOrderHistoryBillDetailView(entry, {}, 'zh');
    assert.equal(view.tableLines.length, 1);
    assert.equal(view.showSplitSection, true);
    assert.equal(view.personRows.length, 2);
  });

  it('uses close snapshot lines for forced unpaid operational closes', () => {
    const entry = baseEntry({
      settlement: {
        outcome: 'closed_without_billing',
        summary: null,
        showFinancialDetails: false,
        collectedPayments: [],
        listAmount: null,
        listAmountKind: null,
        paidRevenue: null,
      },
      closeAnnotation: {
        isForcedUnpaidClose: true,
        reasonCode: 'test_order',
        reasonDetail: 'uat',
      },
      orders: [
        {
          id: 'o1',
          items: [
            {
              id: 'd1',
              name: 'Water',
              name_pt: 'Agua',
              qty: 1,
              price: 2,
              emoji: '💧',
              item_status: 'voided',
              voided_at: '2026-07-05T10:00:00.000Z',
            },
            {
              id: 'd2',
              name: 'Cola',
              name_pt: 'Cola',
              qty: 1,
              price: 3,
              emoji: '🥤',
              item_status: 'voided',
              voided_at: '2026-07-05T12:00:00.200Z',
            },
          ],
        },
      ] as OrderHistoryEntry['orders'],
    });

    const view = buildOrderHistoryBillDetailView(entry, {}, 'zh');
    assert.equal(view.tableLines.length, 1);
    assert.match(view.tableLines[0].label, /Cola/);
  });
});
