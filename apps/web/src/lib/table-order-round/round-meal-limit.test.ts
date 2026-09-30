import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  previewGuestRoundCartMealGate,
  previewGuestRoundLineMealGate,
  resolveRoundLineMealLimitApply,
} from './round-meal-limit';
import type { Order } from '@/types';

const limited = {
  price: 0,
  per_person_qty_limit: 2,
  over_limit_unit_price: 3.5,
};

describe('resolveRoundLineMealLimitApply', () => {
  it('applies meal limit when free dish has per-person + overage price', () => {
    assert.deepEqual(resolveRoundLineMealLimitApply(limited), {
      ok: true,
      applyMealLimit: true,
      perPersonMealLimit: 2,
    });
  });

  it('skips meal limit for unpaid unlimited free dishes', () => {
    assert.deepEqual(
      resolveRoundLineMealLimitApply({ price: 0, per_person_qty_limit: null }),
      { ok: true, applyMealLimit: false, perPersonMealLimit: null },
    );
  });

  it('rejects limited free dish missing overage price', () => {
    assert.deepEqual(
      resolveRoundLineMealLimitApply({
        price: 0,
        per_person_qty_limit: 2,
        over_limit_unit_price: null,
      }),
      { ok: false, error: 'over_limit_price_missing' },
    );
  });
});

describe('previewGuestRoundLineMealGate', () => {
  it('blocks when cart add would exceed meal free allowance with empty round', () => {
    const r = previewGuestRoundLineMealGate({
      serviceMode: 'sushi',
      guestCount: 1,
      sessionOrders: [],
      roundLines: [],
      guestClientId: 'g1',
      menuItemId: 'm1',
      note: '',
      qty: 3,
      qtyMode: 'add',
      item: limited,
    });
    assert.deepEqual(r, { ok: false, error: 'per_person_limit_exceeded' });
  });

  it('counts other round lines and session orders toward already ordered', () => {
    const orders = [
      {
        status: 'cooking',
        items: [{ id: 'm1', qty: 1, kind: 'menu', price: 0 }],
      },
    ] as unknown as Order[];
    const r = previewGuestRoundLineMealGate({
      serviceMode: 'sushi',
      guestCount: 1,
      sessionOrders: orders,
      roundLines: [
        { menu_item_id: 'm1', guest_client_id: 'peer', note: '', qty: 1 },
      ],
      guestClientId: 'g1',
      menuItemId: 'm1',
      note: '',
      qty: 1,
      qtyMode: 'add',
      item: limited,
    });
    // allowance 2; already 1 session + 1 peer = 2; add 1 → exceed
    assert.deepEqual(r, { ok: false, error: 'per_person_limit_exceeded' });
  });

  it('allows set within remaining after excluding the line being edited', () => {
    const r = previewGuestRoundLineMealGate({
      serviceMode: 'sushi',
      guestCount: 1,
      sessionOrders: [],
      roundLines: [
        { menu_item_id: 'm1', guest_client_id: 'g1', note: '', qty: 2 },
      ],
      guestClientId: 'g1',
      menuItemId: 'm1',
      note: '',
      qty: 2,
      qtyMode: 'set',
      item: limited,
    });
    assert.deepEqual(r, { ok: true });
  });
});

describe('previewGuestRoundCartMealGate', () => {
  it('blocks second cart row when cumulative add exceeds meal allowance', () => {
    const r = previewGuestRoundCartMealGate({
      serviceMode: 'sushi',
      guestCount: 1,
      sessionOrders: [],
      roundLines: [],
      guestClientId: 'g1',
      cart: [
        { menuItemId: 'm1', qty: 2, note: '', item: limited },
        { menuItemId: 'm1', qty: 1, note: 'extra spicy', item: limited },
      ],
    });
    assert.deepEqual(r, { ok: false, error: 'per_person_limit_exceeded' });
  });

  it('allows sequential adds that stay within allowance', () => {
    const r = previewGuestRoundCartMealGate({
      serviceMode: 'sushi',
      guestCount: 1,
      sessionOrders: [],
      roundLines: [],
      guestClientId: 'g1',
      cart: [
        { menuItemId: 'm1', qty: 1, note: '', item: limited },
        { menuItemId: 'm1', qty: 1, note: 'wasabi', item: limited },
      ],
    });
    assert.deepEqual(r, { ok: true });
  });
});
