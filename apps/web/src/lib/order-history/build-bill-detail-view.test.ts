import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveSectionOrder,
  resolveTableItemsDefaultOpen,
  shouldShowPersonLedger,
} from '@/lib/order-history/build-detail-presentation';
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
  it('builds unified person ledger for paid by_item sessions', () => {
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
        collectedPayments: [
          {
            id: 'p1',
            person_index: 0,
            person_name: 'John',
            amount: 6,
            created_at: '2026-07-05T12:01:00.000Z',
          },
          {
            id: 'p2',
            person_index: 1,
            person_name: 'Mike',
            amount: 4,
            created_at: '2026-07-05T12:02:00.000Z',
          },
        ],
        listAmount: 10,
        listAmountKind: 'paid',
        paidRevenue: 10,
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
    assert.equal(view.personLedger.show, true);
    assert.equal(view.personLedger.rows.length, 2);
    assert.equal(view.settlement?.variant, 'settled_compact');
    assert.deepEqual(view.sectionOrder, ['settlement', 'person_ledger', 'table_items']);
    assert.equal(view.tableItemsDefaultOpen, true);
  });

  it('hides person ledger for whole-table checkout', () => {
    const entry = baseEntry({
      billSplit: {
        id: 'split-1',
        session_id: 'sess-1',
        table_id: 'table-1',
        discount_rate: 0,
        status: 'paid',
        total_amount: 10,
        split_mode: 'custom',
        persons: [],
        result: [{ name: '__whole_table__', amount: 10, paid: true }],
      },
    });

    const view = buildOrderHistoryBillDetailView(entry, {}, 'zh');
    assert.equal(view.personLedger.show, false);
    assert.deepEqual(view.sectionOrder, ['settlement', 'table_items']);
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
    assert.equal(view.settlement, null);
  });
});

describe('build-detail-presentation helpers', () => {
  it('orders person ledger before table items for settled by_item splits', () => {
    assert.deepEqual(
      resolveSectionOrder('fully_paid', true, 'by_item', true),
      ['settlement', 'person_ledger', 'table_items'],
    );
  });

  it('defaults table items open for short unpaid closes', () => {
    assert.equal(
      resolveTableItemsDefaultOpen(8, 'unpaid_closed', true, 'even'),
      true,
    );
  });

  it('does not show person ledger for whole-table payer row', () => {
    assert.equal(
      shouldShowPersonLedger(
        [
          {
            index: 0,
            name: '__whole_table__',
            obligationAmount: 10,
            collectedAmount: 10,
            outstandingAmount: 0,
            settlementStatus: 'settled',
          },
        ],
        {
          id: 'split-1',
          session_id: 'sess-1',
          table_id: 'table-1',
          discount_rate: 0,
          status: 'paid',
          total_amount: 10,
          split_mode: 'custom',
          persons: [],
          result: [],
        },
      ),
      false,
    );
  });
});
