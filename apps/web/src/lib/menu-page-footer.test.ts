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
  notePresetGroupIds: [],
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

  it('uses roundReview phase when cart is empty and own round lines exist', () => {
    const view = deriveMenuPageFooter({
      ...base,
      roundOwnQty: 3,
      recentOrders: [orderWithItems([{ id: 'i1', name: 'x', name_pt: 'x', qty: 1, price: 3, emoji: '🍽' }])],
    });
    assert.equal(view.phase, 'roundReview');
    assert.equal(view.primaryAction, 'openRoundReview');
    assert.equal(view.roundOwnQty, 3);
    assert.equal(view.showOrderedCta, true);
  });

  it('prefers draft over roundReview when cart has items', () => {
    const view = deriveMenuPageFooter({
      ...base,
      cart: [cartLine],
      roundOwnQty: 4,
    });
    assert.equal(view.phase, 'draft');
    assert.equal(view.primaryAction, 'openCart');
  });

  it('counts submitted portions by qty not row count', () => {
    const view = deriveMenuPageFooter({
      ...base,
      recentOrders: [
        orderWithItems([
          { id: 'i1', name: 'x', name_pt: 'x', qty: 5, price: 0, emoji: '🍽' },
          { id: 'i2', name: 'y', name_pt: 'y', qty: 2, price: 3, emoji: '🍽' },
        ]),
      ],
    });
    assert.equal(view.submittedCount, 7);
  });

  it('excludes buffet_base from submitted portion count', () => {
    const view = deriveMenuPageFooter({
      ...base,
      recentOrders: [
        orderWithItems([
          {
            id: 'bf',
            name: 'buffet',
            name_pt: 'buffet',
            qty: 1,
            price: 20,
            emoji: '🍽',
            kind: 'buffet_base',
            buffet_id: 'buffet-1',
            adult_count: 2,
            child_count: 1,
          },
          { id: 'i1', name: 'x', name_pt: 'x', qty: 3, price: 0, emoji: '🍽' },
        ]),
      ],
    });
    assert.equal(view.submittedCount, 3);
  });

  it('shows ordered phase and enables bill when only buffet_base has money', () => {
    const view = deriveMenuPageFooter({
      ...base,
      recentOrders: [
        orderWithItems([
          {
            id: 'bf',
            name: 'buffet',
            name_pt: 'buffet',
            qty: 1,
            price: 79.8,
            emoji: '🍽',
            kind: 'buffet_base',
            buffet_id: 'buffet-1',
            adult_count: 4,
            child_count: 0,
          },
        ]),
      ],
    });
    assert.equal(view.phase, 'ordered');
    assert.equal(view.primaryAction, 'viewBill');
    assert.equal(view.submittedCount, 0);
    assert.equal(view.submittedTotal, 79.8);
    assert.equal(view.showOrderedCta, false);
    assert.equal(view.billEnabled, true);
  });

  it('keeps bill disabled when buffet_base amount is zero', () => {
    const view = deriveMenuPageFooter({
      ...base,
      recentOrders: [
        orderWithItems([
          {
            id: 'bf',
            name: 'buffet',
            name_pt: 'buffet',
            qty: 1,
            price: 0,
            emoji: '🍽',
            kind: 'buffet_base',
            buffet_id: 'buffet-1',
            adult_count: 0,
            child_count: 0,
          },
        ]),
      ],
    });
    assert.equal(view.phase, 'idle');
    assert.equal(view.submittedTotal, 0);
    assert.equal(view.billEnabled, false);
  });

  it('uses ordered phase when cart is empty and submitted exist', () => {
    const view = deriveMenuPageFooter({
      ...base,
      recentOrders: [orderWithItems([{ id: 'i1', name: 'x', name_pt: 'x', qty: 1, price: 3, emoji: '🍽' }])],
    });
    assert.equal(view.phase, 'ordered');
    assert.equal(view.primaryAction, 'viewOrdered');
    assert.equal(view.submittedCount, 1);
    assert.equal(view.submittedTotal, 3);
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
    assert.equal(view.submittedTotal, 11);
  });

  it('enables bill CTA when session has billable total', () => {
    const view = deriveMenuPageFooter({
      ...base,
      recentOrders: [orderWithItems([{ id: 'i1', name: 'x', name_pt: 'x', qty: 1, price: 3, emoji: '🍽' }])],
    });
    assert.equal(view.billEnabled, true);
    assert.match(view.billHref, /\/cafe\/bill\?table_id=table-1/);
  });

  it('disables bill CTA when session billable total is zero', () => {
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
