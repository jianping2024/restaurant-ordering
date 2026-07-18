import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildOrderHistorySessionView,
  toOrderHistoryDetail,
  toOrderHistoryListItem,
} from '@/lib/order-history/build-session-view';
import type { OrderHistoryBillSplitSummary } from '@/lib/order-history-bill-splits';
import type { Order } from '@/types';

const paidSplit: OrderHistoryBillSplitSummary = {
  id: 'bs1',
  session_id: 'sess-1',
  table_id: 'table-1',
  discount_rate: 0,
  status: 'paid',
  total_amount: 20,
  result: [{ name: 'Total', amount: 20, paid: true }],
};

const orders: Order[] = [
  {
    id: 'ord-1',
    restaurant_id: 'rest-1',
    table_id: 'table-1',
    session_id: 'sess-1',
    display_name: 'A1',
    status: 'done',
    total_amount: 20,
    items: [
      {
        id: 'item-1',
        menu_item_id: 'm1',
        name: 'Soup',
        name_pt: 'Sopa',
        qty: 1,
        price: 20,
        item_status: 'done',
        emoji: '🍲',
      },
    ],
    created_at: '2026-01-01T12:00:00.000Z',
    updated_at: '2026-01-01T12:00:00.000Z',
  } as Order,
];

describe('order history list/detail projection', () => {
  it('builds list without orders, items, split.result, or collectedPayments', () => {
    const view = buildOrderHistorySessionView({
      session: {
        id: 'sess-1',
        table_id: 'table-1',
        closed_at: '2026-01-01T13:00:00.000Z',
        opened_by_user_id: null,
      },
      orders,
      openedByName: null,
      billSplit: paidSplit,
      collectedPayments: [
        {
          id: 'pay-1',
          person_index: 0,
          person_name: 'Total',
          amount: 20,
          created_at: '2026-01-01T12:30:00.000Z',
        },
      ],
    });

    const list = toOrderHistoryListItem(view);
    assert.equal(list.displayName, 'A1');
    assert.equal(list.itemCount, 1);
    assert.equal(list.listAmount, 20);
    assert.equal(list.listAmountKind, 'paid');
    assert.deepEqual(list.billSplit, {
      id: 'bs1',
      session_id: 'sess-1',
      table_id: 'table-1',
      discount_rate: 0,
    });
    assert.equal('orders' in list, false);
    assert.equal('settlement' in list, false);
    assert.equal('chips' in list, false);
    assert.equal(list.billSplit && 'result' in list.billSplit, false);
    assert.equal(list.billSplit && 'status' in list.billSplit, false);
  });

  it('keeps listAmount aligned with detail settlement from the same view', () => {
    const view = buildOrderHistorySessionView({
      session: {
        id: 'sess-1',
        table_id: 'table-1',
        closed_at: '2026-01-01T13:00:00.000Z',
        opened_by_user_id: null,
      },
      orders,
      openedByName: 'Ada',
      billSplit: paidSplit,
      collectedPayments: [],
    });

    const list = toOrderHistoryListItem(view);
    const detail = toOrderHistoryDetail(view);

    assert.equal(list.listAmount, detail.settlement.listAmount);
    assert.equal(list.listAmountKind, detail.settlement.listAmountKind);
    assert.equal(detail.chips.length, 1);
    assert.equal(detail.chips[0]?.name, 'Sopa');
    assert.equal(detail.openedByName, 'Ada');
    assert.equal('orders' in detail, false);
  });
});
