#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { listAbnormalOperations } from '../apps/web/src/lib/abnormal-operations/owner-query.ts';
import {
  loadDashboardOverviewPrimary,
  loadDashboardOverviewSecondary,
} from '../apps/web/src/lib/dashboard-overview.ts';
import { addCalendarDays, calendarDateInTimezone } from '../apps/web/src/lib/lisbon-calendar.ts';

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
if (!restaurant) throw new Error('missing restaurant');
const id = restaurant.id;
const today = calendarDateInTimezone(new Date());

const t0 = performance.now();
const primary = await loadDashboardOverviewPrimary(admin, id);
const primaryMs = Math.round(performance.now() - t0);

const t1 = performance.now();
const secondary = await loadDashboardOverviewSecondary(admin, id);
const secondaryMs = Math.round(performance.now() - t1);

const t2 = performance.now();
await Promise.all([
  loadDashboardOverviewPrimary(admin, id),
  loadDashboardOverviewSecondary(admin, id),
]);
const parallelBothMs = Math.round(performance.now() - t2);

const t3 = performance.now();
const ab = await listAbnormalOperations(admin, {
  restaurantId: id,
  startDate: addCalendarDays(today, -29),
  endDate: today,
  page: 1,
  pageSize: 20,
});
const abnormal30dMs = Math.round(performance.now() - t3);

console.log(
  JSON.stringify(
    {
      primaryMs,
      secondaryMs,
      parallelBothMs,
      abnormal30dMs,
      abOk: ab.ok,
      abTotal: ab.ok ? ab.result.total : null,
      abPendingStats: ab.ok ? ab.result.stats.pending_count : null,
      overviewPending: primary.pendingActions.pendingAbnormal,
      feedbackSessions: secondary.feedback.sessionsWithFeedback,
    },
    null,
    2,
  ),
);
