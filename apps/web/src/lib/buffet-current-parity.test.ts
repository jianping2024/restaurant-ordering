import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { currentTableBuffetLine } from '@/lib/buffet-order';
import type { OrderItem } from '@/types';

/**
 * Parity: TS `currentTableBuffetLine` ≡ SQL `public.table_session_current_buffet_id`.
 * The SQL half runs against local Docker Postgres inside one rolled-back transaction;
 * it skips (never passes silently) when that container is not reachable.
 */

const B1 = 'b0000001-0000-4000-8000-000000000001';
const B2 = 'b0000002-0000-4000-8000-000000000002';

function line(buffetId: string | null, addedAt: string | undefined, extra: Partial<OrderItem> = {}): OrderItem {
  return {
    id: `buffet:${buffetId ?? 'none'}`,
    kind: 'buffet_base',
    name: 'Buffet',
    name_pt: 'Buffet',
    qty: 1,
    price: 10,
    emoji: '🍽️',
    item_status: 'done',
    ...(buffetId ? { buffet_id: buffetId } : {}),
    adult_count: 1,
    child_count: 0,
    ...(addedAt ? { added_at: addedAt } : {}),
    ...extra,
  };
}

const dish: OrderItem = {
  id: 'd1',
  name: 'Dish',
  name_pt: 'Dish',
  qty: 1,
  price: 3,
  emoji: '🍣',
  item_status: 'pending',
  added_at: '2026-11-07T13:00:00.000Z',
};

type Case = { name: string; orders: OrderItem[][] };

const CASES: Case[] = [
  { name: 'no orders', orders: [] },
  { name: 'dishes only', orders: [[dish]] },
  { name: 'one active line', orders: [[line(B1, '2026-11-07T12:00:00.000Z'), dish]] },
  {
    name: 'switched: old voided, new active',
    orders: [[
      line(B1, '2026-11-07T12:00:00.000Z', { item_status: 'voided' }),
      line(B2, '2026-11-07T12:30:00.000Z'),
    ]],
  },
  {
    name: 'cleared: every line voided',
    orders: [[line(B1, '2026-11-07T12:00:00.000Z', { item_status: 'voided' })]],
  },
  {
    name: 'legacy two active packages across orders → newest wins',
    orders: [
      [line(B2, '2026-11-07T12:40:00.000Z')],
      [line(B1, '2026-11-07T12:10:00.000Z'), dish],
    ],
  },
  {
    name: 'line without added_at loses to a dated line',
    orders: [[line(B2, undefined), line(B1, '2026-11-07T12:00:00.000Z')]],
  },
  { name: 'line without buffet_id ignored', orders: [[line(null, '2026-11-07T12:00:00.000Z')]] },
];

function tsResult(c: Case): string {
  const orders = c.orders.map((items) => ({ items, status: 'pending' as const }));
  return currentTableBuffetLine(orders)?.buffet_id ?? '';
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function buildParitySql(): string {
  const parts: string[] = [
    'begin;',
    // Throwaway session on any existing table (closed → no open-session uniqueness clash).
    `create temp table parity_sessions (idx int, session_id uuid) on commit drop;`,
  ];
  CASES.forEach((c, idx) => {
    parts.push(
      `with s as (insert into public.table_sessions (restaurant_id, table_id, status, opened_at, closed_at)
        select restaurant_id, id, 'closed', now(), now() from public.restaurant_tables limit 1
        returning id, restaurant_id, table_id)
       insert into parity_sessions select ${idx}, id from s;`,
    );
    c.orders.forEach((items) => {
      parts.push(
        `insert into public.orders (restaurant_id, session_id, table_id, display_name, status, items, total_amount)
         select s.restaurant_id, s.id, s.table_id, 'parity', 'pending', ${sqlLiteral(JSON.stringify(items))}::jsonb, 0
         from public.table_sessions s join parity_sessions p on p.session_id = s.id where p.idx = ${idx};`,
      );
    });
  });
  parts.push(
    `select p.idx || '|' || coalesce(public.table_session_current_buffet_id(s)::text, '')
     from parity_sessions p join public.table_sessions s on s.id = p.session_id order by p.idx;`,
    'rollback;',
  );
  return parts.join('\n');
}

function runSql(sql: string): string[] | null {
  try {
    const out = execFileSync(
      'docker',
      ['exec', '-i', 'supabase_db_restaurant-ordering', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return out.split('\n').filter((row) => /^\d+\|/.test(row));
  } catch {
    return null;
  }
}

describe('current buffet TS ≡ SQL', () => {
  it('TS picks the newest active buffet_base line', () => {
    assert.deepEqual(
      CASES.map(tsResult),
      ['', '', B1, B2, '', B2, B1, ''],
    );
  });

  it('SQL table_session_current_buffet_id matches TS on every case', (t) => {
    const rows = runSql(buildParitySql());
    if (!rows) {
      t.skip('local Docker Postgres (supabase_db_restaurant-ordering) not reachable');
      return;
    }
    const sqlByIdx = new Map(rows.map((row) => {
      const [idx, value] = row.split('|');
      return [Number(idx), value ?? ''];
    }));
    CASES.forEach((c, idx) => {
      assert.equal(sqlByIdx.get(idx), tsResult(c), c.name);
    });
  });
});
