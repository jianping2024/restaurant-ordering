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

  it('uses idle phase when cart and submitted are empty', () => {
    const view = deriveMenuPageFooter({ ...base });
    assert.equal(view.phase, 'idle');
    assert.equal(view.primaryAction, 'viewBill');
    assert.equal(view.submittedCount, 0);
    assert.equal(view.submittedTotal, 0);
    assert.equal(view.showOrderedCta, false);
  });

  it('uses draft phase when cart has items', () => {
    const view = deriveMenuPageFooter({ ...base, cart: [cartLine] });
    assert.equal(view.phase, 'draft');
    assert.equal(view.primaryAction, 'openCart');
    assert.equal(view.cartQty, 2);
    assert.equal(view.cartTotal, 4);
  });

  it('prefers draft phase when cart and submitted both exist', () => {
    const view = deriveMenuPageFooter({
      ...base,
      cart: [cartLine],
      recentOrders: [orderWithItems([{ id: 'i1', name: 'x', name_pt: 'x', qty: 1, price: 3, emoji: '🍽' }])],
    });
    assert.equal(view.phase, 'draft');
    assert.equal(view.primaryAction, 'openCart');
    assert.equal(view.submittedCount, 1);
  });

  it('uses ordered phase when cart is empty and submitted exist', () => {
    const view = deriveMenuPageFooter({
      ...base,
      recentOrders: [orderWithItems([{ id: 'i1', name: 'x', name_pt: 'x', qty: 1, price: 3, emoji: '🍽' }])],
    });
    assert.equal(view.phase, 'ordered');
    assert.equal(view.primaryAction, 'viewOrdered');
    assert.equal(view.submittedCount, 1);
    assert.equal(view.submittedTotal, 10);
    assert.equal(view.showOrderedCta, true);
  });

  it('sums submittedTotal across multiple orders', () => {
    const view = deriveMenuPageFooter({
      ...base,
      recentOrders: [
        { ...orderWithItems([{ id: 'i1', name: 'x', name_pt: 'x', qty: 1, price: 3, emoji: '🍽' }]), total_amount: 12.5 },
        { ...orderWithItems([{ id: 'i2', name: 'y', name_pt: 'y', qty: 2, price: 4, emoji: '🍽' }]), id: 'o2', total_amount: 8 },
      ],
    });
    assert.equal(view.submittedTotal, 20.5);
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

  it('hides bill and ordered CTAs for staff-assisted waiter flow', () => {
    const staffAssisted = {
      variant: 'staff' as const,
      returnHref: '/dashboard/waiter/t1',
      redirectAfterSubmit: true,
      showBillCta: false,
      skipGeoFence: true,
      skipFeedback: true,
      checkoutRedirectHref: null,
    };
    const view = deriveMenuPageFooter({
      ...base,
      staffAssisted,
      recentOrders: [orderWithItems([{ id: 'i1', name: 'x', name_pt: 'x', qty: 1, price: 3, emoji: '🍽' }])],
    });
    assert.equal(view.showBillCta, false);
    assert.equal(view.showOrderedCta, false);
  });
});
