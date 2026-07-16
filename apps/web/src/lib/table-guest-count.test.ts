import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  guestCountFromTableOrders,
  isBillGuestCountConfirmed,
} from './table-guest-count';
import type { Order } from '@/types';

function orderWithItems(items: Order['items']): Order {
  return {
    id: 'o1',
    restaurant_id: 'r1',
    table_id: 't1',
    display_name: 'A1',
    session_id: 's1',
    status: 'done',
    items,
    total_amount: 0,
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-01T10:00:00.000Z',
  } as Order;
}

describe('guestCountFromTableOrders / isBillGuestCountConfirmed', () => {
  it('returns 0 when there is no buffet_base line', () => {
    const orders = [
      orderWithItems([
        {
          id: 'm1',
          name: 'Drink',
          name_pt: 'Drink',
          emoji: '🥤',
          price: 3,
          qty: 1,
          kind: 'menu',
        },
      ]),
    ];
    assert.equal(guestCountFromTableOrders(orders), 0);
    assert.equal(isBillGuestCountConfirmed(orders), false);
  });

  it('returns 0 for buffet_base with A0C0', () => {
    const orders = [
      orderWithItems([
        {
          id: 'b1',
          name: 'Buffet',
          name_pt: 'Buffet',
          emoji: '🍽️',
          price: 0,
          qty: 1,
          kind: 'buffet_base',
          adult_count: 0,
          child_count: 0,
          added_at: '2026-01-01T10:00:00.000Z',
        },
      ]),
    ];
    assert.equal(guestCountFromTableOrders(orders), 0);
    assert.equal(isBillGuestCountConfirmed(orders), false);
  });

  it('confirms when adults or children are present', () => {
    const adultsOnly = [
      orderWithItems([
        {
          id: 'b1',
          name: 'Buffet',
          name_pt: 'Buffet',
          emoji: '🍽️',
          price: 40,
          qty: 1,
          kind: 'buffet_base',
          adult_count: 2,
          child_count: 0,
          added_at: '2026-01-01T10:00:00.000Z',
        },
      ]),
    ];
    assert.equal(guestCountFromTableOrders(adultsOnly), 2);
    assert.equal(isBillGuestCountConfirmed(adultsOnly), true);

    const childrenOnly = [
      orderWithItems([
        {
          id: 'b1',
          name: 'Buffet',
          name_pt: 'Buffet',
          emoji: '🍽️',
          price: 20,
          qty: 1,
          kind: 'buffet_base',
          adult_count: 0,
          child_count: 1,
          added_at: '2026-01-01T10:00:00.000Z',
        },
      ]),
    ];
    assert.equal(guestCountFromTableOrders(childrenOnly), 1);
    assert.equal(isBillGuestCountConfirmed(childrenOnly), true);
  });

  it('ignores voided buffet_base lines', () => {
    const orders = [
      orderWithItems([
        {
          id: 'b1',
          name: 'Buffet',
          name_pt: 'Buffet',
          emoji: '🍽️',
          price: 40,
          qty: 1,
          kind: 'buffet_base',
          adult_count: 3,
          child_count: 0,
          item_status: 'voided',
          added_at: '2026-01-01T10:00:00.000Z',
        },
      ]),
    ];
    assert.equal(guestCountFromTableOrders(orders), 0);
    assert.equal(isBillGuestCountConfirmed(orders), false);
  });
});
