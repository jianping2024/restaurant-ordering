#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  loadClosedSessionRevenueBundle,
  loadClosedSessionRevenueBundleRpc,
  todayRevenueFromBundle,
} from '../apps/web/src/lib/analytics/closed-session-revenue.ts';
import { resolveTodayLisbonWindow } from '../apps/web/src/lib/analytics/date-window.ts';
import { loadDashboardOverviewPrimary } from '../apps/web/src/lib/dashboard-overview.ts';

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(resolve(process.cwd(), path), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv('.env.local');
Object.assign(process.env, env);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: restaurant } = await admin
  .from('restaurants')
  .select('id')
  .eq('slug', 'restaurant-mohnrib5')
  .maybeSingle();
const id = restaurant.id;
const w = resolveTodayLisbonWindow(new Date());

const t0 = performance.now();
const multi = await loadClosedSessionRevenueBundle(admin, id, w.startUtc, w.endExclusiveUtc);
const multiMs = Math.round(performance.now() - t0);

const t1 = performance.now();
const rpc = await loadClosedSessionRevenueBundleRpc(admin, id, w.startUtc, w.endExclusiveUtc);
const rpcMs = Math.round(performance.now() - t1);

const a = multi.ok ? todayRevenueFromBundle(multi.bundle, w.today) : null;
const b = rpc.ok ? todayRevenueFromBundle(rpc.bundle, w.today) : null;

const t2 = performance.now();
const primary = await loadDashboardOverviewPrimary(admin, id);
const primaryMs = Math.round(performance.now() - t2);

console.log(
  JSON.stringify(
    {
      multiMs,
      rpcMs,
      primaryMs,
      multiOk: multi.ok,
      rpcOk: rpc.ok,
      match: JSON.stringify(a) === JSON.stringify(b),
      a,
      b,
      revenueAvailable: primary.todayKpis.revenueAvailable,
      todayRevenue: primary.todayKpis.todayRevenue,
      pendingAbnormal: primary.pendingActions.pendingAbnormal,
    },
    null,
    2,
  ),
);
