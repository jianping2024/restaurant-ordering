import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';

/**
 * SQL `public.buffet_openable_ids` (可开台) against local Docker Postgres in one rolled-back
 * transaction on a throwaway restaurant. Skips (never passes silently) without that container.
 * November / December in Lisbon = WET (UTC+0), so `…Z` below is Lisbon wall time.
 */

const LUNCH_BUFFET = 'c0000001-0000-4000-8000-000000000001';
const NIGHT_BUFFET = 'c0000002-0000-4000-8000-000000000002';
const HOLIDAY_BUFFET = 'c0000003-0000-4000-8000-000000000003';
const DISABLED_BUFFET = 'c0000004-0000-4000-8000-000000000004';
const EXPIRED_BUFFET = 'c0000005-0000-4000-8000-000000000005';

const FIXTURE_SQL = `
begin;
insert into public.restaurants (id, name, slug, deployment_mode, buffet_friday_weekend_from)
values ('c0000000-0000-4000-8000-000000000000', 'openable test', 'openable-test-${Date.now()}', 'on_prem', '18:00');
insert into public.buffet_time_slots (id, restaurant_id, name, start_time, end_time, weekdays, sort_order) values
  ('c00000a1-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000000', 'lunch', '11:00', '15:00', '{0,1,2,3,4,5,6}', 1),
  ('c00000a2-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000000', 'dinner', '18:00', '22:00', '{0,1,2,3,4,5,6}', 2),
  ('c00000a3-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000000', 'late', '23:00', '02:00', '{0,1,2,3,4,5,6}', 3);
insert into public.buffets (id, restaurant_id, name, is_active) values
  ('${LUNCH_BUFFET}', 'c0000000-0000-4000-8000-000000000000', 'lunch', true),
  ('${NIGHT_BUFFET}', 'c0000000-0000-4000-8000-000000000000', 'night', true),
  ('${HOLIDAY_BUFFET}', 'c0000000-0000-4000-8000-000000000000', 'holiday', true),
  ('${DISABLED_BUFFET}', 'c0000000-0000-4000-8000-000000000000', 'disabled', false),
  ('${EXPIRED_BUFFET}', 'c0000000-0000-4000-8000-000000000000', 'expired', true);
insert into public.buffet_price_rules (restaurant_id, buffet_id, time_slot_id, calendar_kind, valid_from, valid_to, adult_price, child_price, priority, is_active) values
  ('c0000000-0000-4000-8000-000000000000', '${LUNCH_BUFFET}', 'c00000a1-0000-4000-8000-000000000000', 'weekday', '2026-01-01', null, 10, 5, 0, true),
  ('c0000000-0000-4000-8000-000000000000', '${LUNCH_BUFFET}', 'c00000a1-0000-4000-8000-000000000000', 'weekend', '2026-01-01', null, 12, 6, 0, true),
  ('c0000000-0000-4000-8000-000000000000', '${NIGHT_BUFFET}', 'c00000a3-0000-4000-8000-000000000000', 'weekday', '2026-01-01', null, 15, 7, 0, true),
  ('c0000000-0000-4000-8000-000000000000', '${HOLIDAY_BUFFET}', 'c00000a1-0000-4000-8000-000000000000', 'holiday', '2026-01-01', null, 20, 9, 0, true),
  ('c0000000-0000-4000-8000-000000000000', '${DISABLED_BUFFET}', 'c00000a1-0000-4000-8000-000000000000', 'weekday', '2026-01-01', null, 10, 5, 0, true),
  ('c0000000-0000-4000-8000-000000000000', '${EXPIRED_BUFFET}', 'c00000a1-0000-4000-8000-000000000000', 'weekday', '2026-01-01', '2026-11-04', 10, 5, 0, true);
insert into public.buffet_calendar_overrides (restaurant_id, on_date, kind) values
  ('c0000000-0000-4000-8000-000000000000', '2026-12-25', 'holiday');
`;

const CASES: Array<{ name: string; at: string; expect: string[] }> = [
  { name: 'Thu lunch: inactive + expired rule excluded', at: '2026-11-05T12:00:00Z', expect: [LUNCH_BUFFET] },
  { name: 'Thu 15:00 = lunch end (exclusive) is still nearest', at: '2026-11-05T15:00:00Z', expect: [LUNCH_BUFFET] },
  { name: 'Thu 16:29 nearer lunch than dinner', at: '2026-11-05T16:29:00Z', expect: [LUNCH_BUFFET] },
  { name: 'Thu 16:31 nearer dinner → no buffet priced there', at: '2026-11-05T16:31:00Z', expect: [] },
  { name: 'Thu 23:30 inside cross-midnight slot', at: '2026-11-05T23:30:00Z', expect: [NIGHT_BUFFET] },
  { name: 'Wed 01:00 after midnight still in late slot', at: '2026-11-04T01:00:00Z', expect: [NIGHT_BUFFET] },
  { name: 'Sat lunch → weekend rule', at: '2026-11-07T12:00:00Z', expect: [LUNCH_BUFFET] },
  { name: 'Fri 23:30 after Friday-weekend-from → weekend, night has weekday rule only', at: '2026-11-06T23:30:00Z', expect: [] },
  { name: 'Holiday override (Fri Dec 25) lunch → holiday rule only', at: '2026-12-25T12:00:00Z', expect: [HOLIDAY_BUFFET] },
];

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

describe('buffet_openable_ids (SQL)', () => {
  it('current slot = nearest store slot; needs an active in-date rule for today’s calendar kind', (t) => {
    const selects = CASES.map(
      (c, idx) =>
        `select '${idx}|' || coalesce(string_agg(id::text, ',' order by id), '') from public.buffet_openable_ids('c0000000-0000-4000-8000-000000000000', '${c.at}'::timestamptz) id;`,
    ).join('\n');
    const rows = runSql(`${FIXTURE_SQL}\n${selects}\nrollback;`);
    if (!rows) {
      t.skip('local Docker Postgres (supabase_db_restaurant-ordering) not reachable');
      return;
    }
    const byIdx = new Map(rows.map((row) => {
      const [idx, value] = row.split('|');
      return [Number(idx), value ? value.split(',') : []];
    }));
    CASES.forEach((c, idx) => {
      assert.deepEqual(byIdx.get(idx), [...c.expect].sort(), c.name);
    });
  });
});
