import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveMenuPageFooter } from './menu-page-footer';
import type { CartItem, Order } from '@/types';

const cartLine: CartItem = {
  menuItemId: 'm1',
  name_pt: 'Agua',
  price: 2,
  emoji: '💧',
  qty: 2,
  note: '',
  notePresetKeys: [],
};

const orderWithItems = (items: Order['items']): Order => ({
  id: 'o1',
  restaurant_id: 'r1',
  table_id: 't1',
  session_id: 's1',
  status: 'pending',
  items,
  total_amount: 10,
  created_at: '2026-01-01T00:00:00.000Z',
});

describe('deriveMenuPageFooter', () => {
  const base = {
    cart: [] as CartItem[],
    recentOrders: [] as Order[],
    activeSession: { id: 's1', status: 'open' } as const,
    sessionResolved: true,
    staffAssisted: null,
    restaurantSlug: 'cafe',
    tableId: 'table-1',
  };

  it('hides footer until session is resolved', () => {
    const view = deriveMenuPageFooter({ ...base, sessionResolved: false });
    assert.equal(view.visible, false);
  });

  it('sums draft cart qty and total', () => {
    const view = deriveMenuPageFooter({ ...base, cart: [cartLine] });
    assert.equal(view.cartQty, 2);
    assert.equal(view.cartTotal, 4);
  });

  it('enables bill CTA when session has submitted items', () => {
    const view = deriveMenuPageFooter({
      ...base,
      recentOrders: [orderWithItems([{ id: 'i1', name: 'x', name_pt: 'x', qty: 1, price: 3, emoji: '🍽' }])],
    });
    assert.equal(view.billEnabled, true);
    assert.match(view.billHref, /\/cafe\/bill\?table_id=table-1/);
  });

  it('disables bill CTA when no submitted items', () => {
    const view = deriveMenuPageFooter({ ...base });
    assert.equal(view.billEnabled, false);
  });

  it('hides bill CTA for staff-assisted waiter flow', () => {
    const view = deriveMenuPageFooter({
      ...base,
      staffAssisted: {
        variant: 'slug_waiter',
        returnHref: '/dashboard/waiter/t1',
        redirectAfterSubmit: true,
        showBillCta: false,
        skipGeoFence: true,
        skipFeedback: true,
        checkoutRedirectHref: null,
      },
    });
    assert.equal(view.showBillCta, false);
  });
});
