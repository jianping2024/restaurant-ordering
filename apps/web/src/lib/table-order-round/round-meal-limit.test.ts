import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  previewGuestRoundCartCapGate,
  previewGuestRoundCartDraftGates,
  previewGuestRoundCartMealGate,
  previewGuestRoundLineCapGate,
  previewGuestRoundLineMealGate,
  previewGuestRoundLineSetGates,
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

describe('previewGuestRoundCartCapGate', () => {
  it('blocks when basket + draft would exceed round cap', () => {
    const r = previewGuestRoundCartCapGate({
      linesQtyTotal: 14,
      roundCapTotal: 16,
      cartQtys: [3],
    });
    assert.deepEqual(r, { ok: false, error: 'round_cap_exceeded', used: 17, cap: 16 });
  });

  it('allows draft that lands exactly on cap', () => {
    const r = previewGuestRoundCartCapGate({
      linesQtyTotal: 14,
      roundCapTotal: 16,
      cartQtys: [2],
    });
    assert.deepEqual(r, { ok: true });
  });
});

describe('previewGuestRoundLineCapGate', () => {
  it('excludes current line qty before applying next set', () => {
    const r = previewGuestRoundLineCapGate({
      linesQtyTotal: 16,
      roundCapTotal: 16,
      currentLineQty: 2,
      nextQty: 3,
    });
    // others 14 + 3 = 17
    assert.deepEqual(r, { ok: false, error: 'round_cap_exceeded', used: 17, cap: 16 });
  });
});

describe('previewGuestRoundCartDraftGates', () => {
  it('returns round_cap before meal when both would fail', () => {
    const r = previewGuestRoundCartDraftGates({
      linesQtyTotal: 15,
      roundCapTotal: 16,
      serviceMode: 'sushi',
      guestCount: 1,
      sessionOrders: [],
      roundLines: [],
      guestClientId: 'g1',
      cart: [{ menuItemId: 'm1', qty: 3, note: '', item: limited }],
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, 'round_cap_exceeded');
  });

  it('returns meal error when under round cap but over dish allowance', () => {
    const r = previewGuestRoundCartDraftGates({
      linesQtyTotal: 0,
      roundCapTotal: 16,
      serviceMode: 'sushi',
      guestCount: 1,
      sessionOrders: [],
      roundLines: [],
      guestClientId: 'g1',
      cart: [{ menuItemId: 'm1', qty: 3, note: '', item: limited }],
    });
    assert.deepEqual(r, { ok: false, error: 'per_person_limit_exceeded' });
  });
});

describe('previewGuestRoundLineSetGates', () => {
  it('blocks set that exceeds round cap', () => {
    const r = previewGuestRoundLineSetGates({
      linesQtyTotal: 16,
      roundCapTotal: 16,
      currentLineQty: 1,
      serviceMode: 'sushi',
      guestCount: 2,
      sessionOrders: [],
      roundLines: [{ menu_item_id: 'm1', guest_client_id: 'g1', note: '', qty: 1 }],
      guestClientId: 'g1',
      menuItemId: 'm1',
      note: '',
      qty: 2,
      item: limited,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, 'round_cap_exceeded');
  });
});
