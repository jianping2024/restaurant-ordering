import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applySushiLimitToCartLine,
  classifyStaffQtyIncrease,
  freeAllowanceQty,
  freeRemainingQty,
  guestMaxCartQty,
  isLimitedSushiMenuItem,
  normalizeMenuItemLimitFields,
  previewStaffCartOverage,
  sessionGuestCountForLimits,
  sessionOrderedQtyForMenuItem,
  splitQtyAgainstFreeRemaining,
  sushiLimitHintParts,
} from '@/lib/sushi-buffet-limits';
import type { Order } from '@/types';

describe('sushi buffet limits', () => {
  it('computes free allowance as per-person × guests', () => {
    assert.equal(freeAllowanceQty(2, 4), 8);
    assert.equal(freeAllowanceQty(2, 0), 0);
  });

  it('splits across the free boundary', () => {
    assert.deepEqual(splitQtyAgainstFreeRemaining(5, 2), {
      includedQty: 2,
      overageQty: 3,
    });
    assert.deepEqual(splitQtyAgainstFreeRemaining(2, 5), {
      includedQty: 2,
      overageQty: 0,
    });
  });

  it('sums multi-package headcount', () => {
    const orders = [
      {
        status: 'done',
        items: [
          {
            id: 'buffet:a',
            kind: 'buffet_base',
            buffet_id: 'a',
            adult_count: 2,
            child_count: 1,
            name: 'A',
            name_pt: 'A',
            qty: 1,
            price: 10,
            emoji: '',
            item_status: 'done',
          },
          {
            id: 'buffet:b',
            kind: 'buffet_base',
            buffet_id: 'b',
            adult_count: 1,
            child_count: 0,
            name: 'B',
            name_pt: 'B',
            qty: 1,
            price: 10,
            emoji: '',
            item_status: 'done',
          },
        ],
      },
    ] as Order[];
    assert.equal(sessionGuestCountForLimits(orders), 4);
  });

  it('counts non-voided menu qty and ignores voided', () => {
    const orders = [
      {
        status: 'cooking',
        items: [
          {
            id: 'm1',
            name: 'Nigiri',
            name_pt: 'Nigiri',
            qty: 3,
            price: 0,
            emoji: '',
            item_status: 'pending',
          },
          {
            id: 'm1',
            name: 'Nigiri',
            name_pt: 'Nigiri',
            qty: 2,
            price: 5,
            emoji: '',
            item_status: 'voided',
          },
        ],
      },
    ] as Order[];
    assert.equal(sessionOrderedQtyForMenuItem(orders, 'm1'), 3);
  });

  it('classic mode never treats items as limited', () => {
    assert.equal(
      isLimitedSushiMenuItem('classic', {
        per_person_qty_limit: 2,
        over_limit_unit_price: 3,
      }),
      false,
    );
    assert.equal(
      sushiLimitHintParts('classic', {
        per_person_qty_limit: 2,
        over_limit_unit_price: 3,
      }),
      null,
    );
  });

  it('guest cannot exceed free remaining; staff can with overage price', () => {
    const item = { per_person_qty_limit: 2, over_limit_unit_price: 4.5 };
    const guest = applySushiLimitToCartLine({
      serviceMode: 'sushi',
      staffAssisted: false,
      guestCount: 2,
      alreadyOrdered: 3,
      requestQty: 2,
      menuPrice: 0,
      item,
    });
    assert.equal(guest.ok, false);
    if (!guest.ok) assert.equal(guest.error, 'per_person_limit_exceeded');

    const staff = applySushiLimitToCartLine({
      serviceMode: 'sushi',
      staffAssisted: true,
      guestCount: 2,
      alreadyOrdered: 3,
      requestQty: 2,
      menuPrice: 0,
      item,
    });
    assert.equal(staff.ok, true);
    if (staff.ok) {
      assert.deepEqual(staff.slices, [
        { qty: 1, unitPrice: 0 },
        { qty: 1, unitPrice: 4.5 },
      ]);
    }
  });

  it('blocks limited items when headcount is 0 for guest and staff', () => {
    const item = { per_person_qty_limit: 2, over_limit_unit_price: 4 };
    for (const staffAssisted of [false, true]) {
      const result = applySushiLimitToCartLine({
        serviceMode: 'sushi',
        staffAssisted,
        guestCount: 0,
        alreadyOrdered: 0,
        requestQty: 1,
        menuPrice: 0,
        item,
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error, 'limited_item_requires_headcount');
    }
  });

  it('guestMaxCartQty respects remaining free slots', () => {
    assert.equal(
      guestMaxCartQty({
        serviceMode: 'sushi',
        item: { per_person_qty_limit: 2, over_limit_unit_price: 1 },
        guestCount: 2,
        alreadyOrdered: 3,
        absoluteMax: 99,
      }),
      1,
    );
    assert.equal(
      guestMaxCartQty({
        serviceMode: 'sushi',
        item: { per_person_qty_limit: 2, over_limit_unit_price: 1 },
        guestCount: 0,
        alreadyOrdered: 0,
        absoluteMax: 99,
      }),
      0,
    );
  });

  it('normalizes limit fields as a pair', () => {
    assert.deepEqual(
      normalizeMenuItemLimitFields({
        per_person_qty_limit: 2,
        over_limit_unit_price: 3.5,
      }),
      { ok: true, per_person_qty_limit: 2, over_limit_unit_price: 3.5 },
    );
    assert.equal(
      normalizeMenuItemLimitFields({ per_person_qty_limit: 2 }).ok,
      false,
    );
    assert.deepEqual(normalizeMenuItemLimitFields({}), {
      ok: true,
      per_person_qty_limit: null,
      over_limit_unit_price: null,
    });
  });

  it('freeRemainingQty floors at zero', () => {
    assert.equal(
      freeRemainingQty({ perPersonLimit: 2, guestCount: 2, alreadyOrdered: 10 }),
      0,
    );
  });

  it('classifyStaffQtyIncrease confirms only on first cross', () => {
    const item = { per_person_qty_limit: 2, over_limit_unit_price: 4.5 };
    const base = {
      serviceMode: 'sushi' as const,
      item,
      guestCount: 2,
      alreadyOrdered: 0,
      menuPrice: 0,
    };
    // free allowance = 4
    assert.equal(
      classifyStaffQtyIncrease({ ...base, fromQty: 3, toQty: 4 }).action,
      'allow',
    );
    assert.deepEqual(classifyStaffQtyIncrease({ ...base, fromQty: 4, toQty: 5 }), {
      action: 'confirm_first_cross',
      overageQtyAdded: 1,
      totalOverageQty: 1,
      overLimitUnitPrice: 4.5,
    });
    assert.deepEqual(classifyStaffQtyIncrease({ ...base, fromQty: 5, toQty: 6 }), {
      action: 'toast_more_overage',
      overageQtyAdded: 1,
      totalOverageQty: 2,
      overLimitUnitPrice: 4.5,
    });
    assert.equal(
      classifyStaffQtyIncrease({ ...base, guestCount: 0, fromQty: 0, toQty: 1 }).action,
      'block_headcount',
    );
    // Session already over free: first cart unit must confirm (fromQty 0 must not false-allow)
    assert.deepEqual(
      classifyStaffQtyIncrease({
        ...base,
        alreadyOrdered: 10,
        fromQty: 0,
        toQty: 1,
      }),
      {
        action: 'confirm_first_cross',
        overageQtyAdded: 1,
        totalOverageQty: 1,
        overLimitUnitPrice: 4.5,
      },
    );
  });

  it('previewStaffCartOverage summarizes overage lines', () => {
    const item = { per_person_qty_limit: 1, over_limit_unit_price: 3, price: 0 };
    assert.deepEqual(
      previewStaffCartOverage({
        serviceMode: 'sushi',
        guestCount: 2,
        sessionOrders: [],
        cart: [{ menuItemId: 'a', qty: 3 }],
        resolveItem: () => item,
      }),
      {
        status: 'overage',
        lines: [{ menuItemId: 'a', overageQty: 1, overLimitUnitPrice: 3 }],
      },
    );
    assert.deepEqual(
      previewStaffCartOverage({
        serviceMode: 'sushi',
        guestCount: 2,
        sessionOrders: [],
        cart: [{ menuItemId: 'a', qty: 2 }],
        resolveItem: () => item,
      }),
      { status: 'none' },
    );
    assert.deepEqual(
      previewStaffCartOverage({
        serviceMode: 'sushi',
        guestCount: 0,
        sessionOrders: [],
        cart: [{ menuItemId: 'a', qty: 1 }],
        resolveItem: () => item,
      }),
      { status: 'blocked', error: 'limited_item_requires_headcount' },
    );
  });
});
