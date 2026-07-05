import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildOrderHistoryDetailChips,
  buildOrderListDisplayChips,
  formatOrderItemListLabel,
  formatOrderItemQuantityLabel,
  formatOrderListItemPrintQty,
  orderListGuestLabelsFromLang,
} from '@/lib/order-list-display';
import type { Order } from '@/types';

const guestLabels = { adults: '{n}大人', children: '{n}小孩' };

describe('formatOrderItemQuantityLabel', () => {
  it('formats menu qty', () => {
    assert.equal(
      formatOrderItemQuantityLabel({ kind: 'menu', qty: 2 }),
      '× 2',
    );
  });

  it('formats buffet headcount in compact staff style', () => {
    assert.equal(
      formatOrderItemQuantityLabel(
        { kind: 'buffet_base', qty: 1, adult_count: 7, child_count: 3 },
        { headcountStyle: 'compact' },
      ),
      '· A7 C3',
    );
  });

  it('formats buffet headcount in localized guest style', () => {
    assert.equal(
      formatOrderItemQuantityLabel(
        { kind: 'buffet_base', qty: 1, adult_count: 7, child_count: 3 },
        { headcountStyle: 'localized', guestLabels },
      ),
      '· 7大人 · 3小孩',
    );
  });
});

describe('formatOrderItemListLabel', () => {
  it('joins emoji, name, and quantity label', () => {
    assert.equal(
      formatOrderItemListLabel(
        {
          emoji: '🍽️',
          name: 'Buffet almoço',
          name_pt: 'Buffet almoço',
          kind: 'buffet_base',
          qty: 1,
          adult_count: 7,
          child_count: 3,
        },
        { headcountStyle: 'compact' },
      ),
      '🍽️ Buffet almoço · A7 C3',
    );
  });
});

describe('orderListGuestLabelsFromLang', () => {
  it('reads orderHistory guest count templates', () => {
    const labels = orderListGuestLabelsFromLang('zh');
    assert.equal(labels.adults, '{n}大人');
    assert.equal(labels.children, '{n}小孩');
  });
});

describe('formatOrderListItemPrintQty', () => {
  it('omits leading dot for print column', () => {
    const label = formatOrderListItemPrintQty(
      {
        id: 'b1',
        kind: 'buffet_base',
        name: 'Buffet',
        name_pt: 'Buffet',
        qty: 1,
        price: 100,
        emoji: '🍽️',
        adult_count: 2,
        child_count: 1,
      },
      guestLabels,
    );
    assert.equal(label, '2大人 · 1小孩');
  });
});

describe('buildOrderListDisplayChips', () => {
  it('includes aggregated buffet headcount for active-order style lists', () => {
    const orders = [
      {
        id: 'o1',
        items: [
          {
            id: 'buffet:1',
            kind: 'buffet_base',
            name: 'Buffet almoço',
            name_pt: 'Buffet almoço',
            qty: 1,
            price: 166,
            emoji: '🍽️',
            adult_count: 7,
            child_count: 3,
            buffet_id: 'b1',
          },
          {
            id: 'd1',
            name: 'Sumol',
            name_pt: 'Sumol',
            qty: 1,
            price: 2,
            emoji: '🥤',
          },
        ],
      },
    ] as Order[];

    const chips = buildOrderListDisplayChips(orders, guestLabels);
    assert.equal(chips.length, 2);
    assert.equal(chips[0].name, 'Buffet almoço');
    assert.equal(chips[0].quantityLabel, '· 7大人 · 3小孩');
    assert.equal(chips[1].quantityLabel, '× 1');
  });
});

describe('buildOrderHistoryDetailChips', () => {
  it('marks voided items for detail modal display', () => {
    const orders = [
      {
        id: 'o1',
        items: [
          {
            id: 'd1',
            name: 'Sumol',
            name_pt: 'Sumol',
            qty: 1,
            price: 2,
            emoji: '🥤',
            item_status: 'voided',
          },
          {
            id: 'd2',
            name: 'Water',
            name_pt: 'Agua',
            qty: 2,
            price: 1,
            emoji: '💧',
          },
        ],
      },
    ] as Order[];

    const chips = buildOrderHistoryDetailChips(orders, guestLabels);
    assert.equal(chips.length, 2);
    assert.equal(chips[0].voided, true);
    assert.equal(chips[1].voided, undefined);
  });
});
