import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import {
  isBuffetPricedDishLine,
  planBuffetSwitchLinePrices,
} from '@/lib/buffet-switch-reprice';
import type { MenuItemRow } from '@/lib/resolve-append-cart-items';
import type { OrderItem } from '@/types';

const LUNCH = 'b0000001-0000-4000-8000-000000000001';
const DINNER = 'b0000002-0000-4000-8000-000000000002';

function menuRow(id: string, price: number, extra: Partial<MenuItemRow> = {}): MenuItemRow {
  return {
    id,
    category_id: null,
    name_pt: id,
    name_en: null,
    name_zh: null,
    price,
    emoji: '🍣',
    available: true,
    item_code: null,
    per_person_qty_limit: null,
    over_limit_unit_price: null,
    time_slot_id: null,
    takeaway_role: 'none',
    takeaway_price: null,
    ...extra,
  };
}

function line(id: string, price: number, extra: Partial<OrderItem> = {}): OrderItem {
  return { id, name: id, name_pt: id, qty: 2, price, emoji: '🍣', item_status: 'pending', batch_id: 'b1', ...extra };
}

const LINES: Array<{ name: string; item: OrderItem; priced: boolean }> = [
  { name: 'menu dish', item: line('sashimi', 8.5), priced: true },
  { name: 'explicit kind menu', item: line('sashimi', 8.5, { kind: 'menu' }), priced: true },
  { name: 'voided dish', item: line('sashimi', 8.5, { item_status: 'voided' }), priced: false },
  { name: 'buffet headcount', item: line('buffet:x', 30, { kind: 'buffet_base' }), priced: false },
  { name: 'take-away charge', item: line('takeaway:1', 5, { kind: 'takeaway' }), priced: false },
  { name: 'packaging', item: line('packaging:1', 0.5, { kind: 'packaging' }), priced: false },
  { name: 'kitchen remake', item: line('sashimi', 0, { kitchen_remake: true }), priced: false },
];

describe('planBuffetSwitchLinePrices', () => {
  const menuById = new Map([
    ['sashimi', menuRow('sashimi', 8.5, { per_person_qty_limit: 2, over_limit_unit_price: 3 })],
    ['tempura', menuRow('tempura', 5)],
  ]);
  const buffetPrices = { sashimi: { [LUNCH]: 0 }, tempura: { [DINNER]: 1.5 } };
  const orders = [
    {
      id: 'o1',
      status: 'pending' as const,
      items: [
        line('buffet:x', 30, { kind: 'buffet_base' }),
        line('sashimi', 8.5),
        line('tempura', 5, { note: 'sem sal', item_status: 'done' }),
        line('gone', 4.2, { per_person_qty_limit: 1, over_limit_unit_price: 2 }),
        line('tempura', 5, { item_status: 'voided' }),
      ],
    },
  ];

  it('re-prices every active dish line for the new buffet (sushi allowance follows the price)', () => {
    const plan = planBuffetSwitchLinePrices({
      orders,
      menuById,
      buffetId: LUNCH,
      buffetPrices,
      serviceMode: 'sushi',
      channel: 'dine_in',
    });
    assert.deepEqual(plan, [
      { order_id: 'o1', index: 1, menu_item_id: 'sashimi', batch_id: 'b1', price: 0, per_person_qty_limit: 2, over_limit_unit_price: 3 },
      { order_id: 'o1', index: 2, menu_item_id: 'tempura', batch_id: 'b1', price: 5, per_person_qty_limit: null, over_limit_unit_price: null },
      // Dish deleted from the menu keeps its stored price + allowance.
      { order_id: 'o1', index: 3, menu_item_id: 'gone', batch_id: 'b1', price: 4.2, per_person_qty_limit: 1, over_limit_unit_price: 2 },
    ]);
  });

  it('cleared buffet (0 guests) → original prices; no longer free → allowance removed', () => {
    const plan = planBuffetSwitchLinePrices({
      orders,
      menuById,
      buffetId: null,
      buffetPrices,
      serviceMode: 'sushi',
      channel: 'dine_in',
    });
    assert.deepEqual(plan.map((row) => [row.menu_item_id, row.price, row.per_person_qty_limit]), [
      ['sashimi', 8.5, null],
      ['tempura', 5, null],
      ['gone', 4.2, 1],
    ]);
  });
});

describe('buffet-priced dish line TS ≡ SQL order_item_is_buffet_priced', () => {
  it('TS predicate', () => {
    for (const row of LINES) {
      assert.equal(isBuffetPricedDishLine(row.item, 'pending'), row.priced, row.name);
    }
  });

  it('SQL predicate matches TS on every case', (t) => {
    const sql = LINES.map(
      (row, idx) =>
        `select '${idx}|' || public.order_item_is_buffet_priced('${JSON.stringify(row.item).replace(/'/g, "''")}'::jsonb);`,
    ).join('\n');
    let rows: string[];
    try {
      rows = execFileSync(
        'docker',
        ['exec', '-i', 'supabase_db_restaurant-ordering', 'psql', '-U', 'postgres', '-d', 'postgres', '-At'],
        { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      ).split('\n').filter((r) => /^\d+\|/.test(r));
    } catch {
      t.skip('local Docker Postgres (supabase_db_restaurant-ordering) not reachable');
      return;
    }
    rows.forEach((r) => {
      const [idx, value] = r.split('|');
      const row = LINES[Number(idx)]!;
      assert.equal(value === 'true', row.priced, row.name);
    });
    assert.equal(rows.length, LINES.length);
  });
});
