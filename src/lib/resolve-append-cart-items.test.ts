import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  generateAppendBatchId,
  parseAppendCartRawItems,
  resolveAppendCartItems,
} from './resolve-append-cart-items';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

function mockAdminMenuRows(rows: Array<Record<string, unknown>>): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: async () => ({ data: rows, error: null }),
  };
  return {
    from: () => chain,
  } as unknown as SupabaseClient;
}

const MENU_A = 'e098534a-71c5-46f2-b6e4-5fc466519288';
const MENU_B = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

describe('parseAppendCartRawItems', () => {
  it('accepts menu_item_id rows', () => {
    const r = parseAppendCartRawItems([{ menu_item_id: MENU_A, qty: 2, note: '少辣' }]);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.lines, [{ menuItemId: MENU_A, qty: 2, note: '少辣' }]);
  });

  it('rejects legacy id field', () => {
    assert.equal(parseAppendCartRawItems([{ id: MENU_A, qty: 1 }]).ok, false);
  });

  it('rejects forbidden client fields', () => {
    assert.equal(
      parseAppendCartRawItems([{ menu_item_id: MENU_A, qty: 1, price: 0 }]).ok,
      false,
    );
    assert.equal(
      parseAppendCartRawItems([{ menu_item_id: MENU_A, qty: 1, name_pt: 'x' }]).ok,
      false,
    );
  });

  it('merges duplicate menu_item_id qty and notes', () => {
    const r = parseAppendCartRawItems([
      { menu_item_id: MENU_A, qty: 1, note: 'a' },
      { menu_item_id: MENU_A, qty: 2, note: 'b' },
    ]);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.lines.length, 1);
    assert.equal(r.lines[0].qty, 3);
    assert.equal(r.lines[0].note, 'a; b');
  });

  it('rejects empty array and buffet rows', () => {
    assert.equal(parseAppendCartRawItems([]).ok, false);
    assert.equal(
      parseAppendCartRawItems([{ menu_item_id: `buffet:${MENU_A}`, qty: 1 }]).ok,
      false,
    );
    assert.equal(
      parseAppendCartRawItems([{ menu_item_id: MENU_A, qty: 1, kind: 'buffet_base' }]).ok,
      false,
    );
  });

  it('rejects invalid qty and merged qty over max', () => {
    assert.equal(parseAppendCartRawItems([{ menu_item_id: MENU_A, qty: 0 }]).ok, false);
    assert.equal(parseAppendCartRawItems([{ menu_item_id: MENU_A, qty: 100 }]).ok, false);
    assert.equal(
      parseAppendCartRawItems([
        { menu_item_id: MENU_A, qty: 50 },
        { menu_item_id: MENU_A, qty: 50 },
      ]).ok,
      false,
    );
  });

  it('preserves first-seen order when merging', () => {
    const r = parseAppendCartRawItems([
      { menu_item_id: MENU_A, qty: 1 },
      { menu_item_id: MENU_B, qty: 1 },
      { menu_item_id: MENU_A, qty: 1 },
    ]);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(
      r.lines.map((l) => l.menuItemId),
      [MENU_A, MENU_B],
    );
    assert.equal(r.lines[0].qty, 2);
  });
});

describe('generateAppendBatchId', () => {
  it('uses timestamp prefix', () => {
    const id = generateAppendBatchId(1700000000000);
    assert.match(id, /^1700000000000-[a-z0-9]+$/);
  });
});

describe('resolveAppendCartItems', () => {
  it('maps menu_items price from DB', async () => {
    const r = await resolveAppendCartItems({
      admin: mockAdminMenuRows([
        {
          id: MENU_A,
          name_pt: 'Peixe',
          name_en: null,
          name_zh: null,
          price: '12.5',
          emoji: '🐟',
          available: true,
        },
      ]),
      restaurantId: RESTAURANT_ID,
      rawItems: [{ menu_item_id: MENU_A, qty: 2 }],
      batchId: 'batch-test',
      addedAt: '2026-05-29T12:00:00.000Z',
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.batchId, 'batch-test');
    assert.equal(r.items[0].price, 12.5);
    assert.equal(r.items[0].qty, 2);
    assert.equal(r.items[0].name_pt, 'Peixe');
  });

  it('returns menu_item_not_found when id missing from query', async () => {
    const r = await resolveAppendCartItems({
      admin: mockAdminMenuRows([]),
      restaurantId: RESTAURANT_ID,
      rawItems: [{ menu_item_id: MENU_A, qty: 1 }],
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error, 'menu_item_not_found');
  });

  it('returns menu_item_unavailable when available is false', async () => {
    const r = await resolveAppendCartItems({
      admin: mockAdminMenuRows([
        {
          id: MENU_A,
          name_pt: 'Off',
          name_en: null,
          name_zh: null,
          price: 5,
          emoji: null,
          available: false,
        },
      ]),
      restaurantId: RESTAURANT_ID,
      rawItems: [{ menu_item_id: MENU_A, qty: 1 }],
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error, 'menu_item_unavailable');
  });
});
