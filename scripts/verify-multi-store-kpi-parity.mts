#!/usr/bin/env node
/**
 * Multi-store plan §11.2 scenario 22 — home KPI parity.
 *
 * For EVERY store in the database, compares the batch KPI implementation
 * (`loadTodayKpisForRestaurants(allIds)`, what the multi-store overview uses) with the
 * single-store home (`loadDashboardOverviewPrimary(id).todayKpis`), field by field:
 * 已收 todayRevenue / revenueAvailable / revenueByChannel, 未收 diningUncollectedAmount,
 * 今日桌·人 todayTableCount / todayGuests, 当前用餐桌·人 diningTableCount / diningGuests.
 *
 * Run once per time point (营业中 / 打烊后 / 有未收账单) with `--label`; `--days N` also
 * replays the last N closed Lisbon days (now = 23:59 that day) for revenue on real history.
 * Exit 1 on any mismatch. Local DB only (reads apps/web/.env.local).
 *
 *   cd apps/web && node --import tsx ../../scripts/verify-multi-store-kpi-parity.mts --label 营业中 --days 7
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  loadDashboardOverviewPrimary,
  loadTodayKpisForRestaurants,
  type DashboardTodayKpis,
} from '../apps/web/src/lib/dashboard-overview.ts';

function loadEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(resolve(process.cwd(), path), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const env = loadEnv('.env.local');
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error(`refusing non-local Supabase URL`);
  process.exit(2);
}
Object.assign(process.env, env);
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const label = arg('label', 'now');
const days = Number(arg('days', '0'));

const { data: stores, error } = await admin.from('restaurants').select('id, slug').order('slug');
if (error || !stores) throw new Error(error?.message ?? 'no stores');
// Script-only: every store id, outside the app's auth entry (branded type is app-side).
const ids = stores.map((s) => s.id as string) as never[];
const slugById = new Map(stores.map((s) => [s.id as string, s.slug as string]));

/** End of a past Lisbon day (23:59 local ≈ 22:59Z/23:59Z — 21:00Z is safely inside the day). */
function pastNow(daysAgo: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(21, 0, 0, 0);
  return d;
}

const FIELDS: Array<keyof DashboardTodayKpis> = [
  'todayRevenue',
  'revenueAvailable',
  'revenueByChannel',
  'diningUncollectedAmount',
  'todayTableCount',
  'todayGuests',
  'diningTableCount',
  'diningGuests',
];

const points: Array<{ name: string; now: Date }> = [{ name: label, now: new Date() }];
for (let d = 1; d <= days; d += 1) points.push({ name: `${label}·D-${d}`, now: pastNow(d) });

function diffFields(home: DashboardTodayKpis, batch: DashboardTodayKpis | undefined): string[] {
  const out: string[] = [];
  for (const field of FIELDS) {
    const a = JSON.stringify(home[field]);
    const b = JSON.stringify(batch?.[field]);
    if (a !== b) out.push(`${field}: home=${a} batch=${b}`);
  }
  return out;
}

let compared = 0;
let mismatches = 0;
let transients = 0;
const nonZero = { revenue: 0, uncollected: 0, todayTables: 0, diningTables: 0 };
for (const point of points) {
  const t0 = performance.now();
  const batch = await loadTodayKpisForRestaurants(admin, ids, point.now);
  const batchMs = Math.round(performance.now() - t0);
  let pointMismatch = 0;
  for (const id of ids as unknown as string[]) {
    const home = (await loadDashboardOverviewPrimary(admin, id as never, point.now)).todayKpis;
    const fromBatch = batch.kpisByRestaurantId.get(id as never);
    compared += 1;
    if (home.todayRevenue > 0) nonZero.revenue += 1;
    if (home.diningUncollectedAmount > 0) nonZero.uncollected += 1;
    if (home.todayTableCount > 0) nonZero.todayTables += 1;
    if (home.diningTableCount > 0) nonZero.diningTables += 1;
    let diff = diffFields(home, fromBatch);
    if (diff.length > 0) {
      // Re-read both sides once: a transient query failure flips revenueAvailable on either
      // side by design. Only a difference that survives the re-read is a 口径 mismatch.
      console.log(`TRANSIENT? ${point.name} ${slugById.get(id)} ${diff.join(' ; ')}`);
      const homeAgain = (await loadDashboardOverviewPrimary(admin, id as never, point.now)).todayKpis;
      const batchAgain = (await loadTodayKpisForRestaurants(admin, ids, point.now)).kpisByRestaurantId.get(id as never);
      diff = diffFields(homeAgain, batchAgain);
      if (diff.length === 0) transients += 1;
    }
    for (const line of diff) {
      mismatches += 1;
      pointMismatch += 1;
      console.log(`MISMATCH ${point.name} ${slugById.get(id)} ${line}`);
    }
  }
  console.log(
    `point=${point.name} day=${batch.todayDateKey} stores=${ids.length} batchMs=${batchMs} mismatches=${pointMismatch}`,
  );
}

console.log(
  `SUMMARY label=${label} comparisons=${compared} fields=${FIELDS.length} mismatches=${mismatches} transientReread=${transients} ` +
    `nonzero(revenue=${nonZero.revenue} uncollected=${nonZero.uncollected} todayTables=${nonZero.todayTables} diningTables=${nonZero.diningTables})`,
);
process.exit(mismatches === 0 ? 0 : 1);
