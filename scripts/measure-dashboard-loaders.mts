#!/usr/bin/env node
/**
 * Time real loaders: loadDashboardOverviewView + listAbnormalOperations + double auth probe.
 * Usage: node --import tsx scripts/measure-dashboard-loaders.mts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadDashboardOverviewView } from '../apps/web/src/lib/dashboard-overview.ts';
import { listAbnormalOperations } from '../apps/web/src/lib/abnormal-operations/owner-query.ts';
import { addCalendarDays, calendarDateInTimezone } from '../apps/web/src/lib/lisbon-calendar.ts';

function loadEnv(path: string) {
  const env: Record<string, string> = {};
  for (const line of readFileSync(resolve(process.cwd(), path), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

async function timed<T>(label: string, fn: () => Promise<T>) {
  const start = performance.now();
  const value = await fn();
  return { label, ms: Math.round(performance.now() - start), value };
}

async function main() {
  const env = loadEnv('.env.local');
  for (const [k, v] of Object.entries(env)) {
    if (!process.env[k]) process.env[k] = v;
  }
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('slug', 'restaurant-mohnrib5')
    .maybeSingle();
  if (!restaurant) throw new Error('restaurant missing');

  const restaurantId = restaurant.id as string;
  const today = calendarDateInTimezone(new Date());

  const overview1 = await timed('loadDashboardOverviewView_cold', () =>
    loadDashboardOverviewView(admin, restaurantId),
  );
  const overview2 = await timed('loadDashboardOverviewView_warm', () =>
    loadDashboardOverviewView(admin, restaurantId),
  );

  const abToday = await timed('listAbnormal_today_fullFetch', () =>
    listAbnormalOperations(admin, { restaurantId, startDate: today, endDate: today, page: 1, pageSize: 20 }),
  );
  const ab30 = await timed('listAbnormal_30d_fullFetch', () =>
    listAbnormalOperations(admin, {
      restaurantId,
      startDate: addCalendarDays(today, -29),
      endDate: today,
      page: 1,
      pageSize: 20,
    }),
  );

  // Auth-shaped probes (same queries layout/page do)
  const authA = await timed('auth_getUser_shaped_owner_lookup', async () => {
    // service role cannot getUser; probe owner restaurant select cost twice
    const a = await admin.from('restaurants').select('id, slug, name, suspended_at, service_valid_until').eq('id', restaurantId).maybeSingle();
    return a.data?.id;
  });
  const authB = await timed('auth_owner_lookup_second', async () => {
    const a = await admin.from('restaurants').select('id, slug, name, suspended_at, service_valid_until').eq('id', restaurantId).maybeSingle();
    return a.data?.id;
  });

  console.log(
    JSON.stringify(
      {
        overviewMs: [overview1.ms, overview2.ms],
        overviewPendingAbnormal: overview1.value.pendingActions.pendingAbnormal,
        abnormalToday: { ms: abToday.ms, total: abToday.value.ok ? abToday.value.result.total : null },
        abnormal30d: { ms: ab30.ms, total: ab30.value.ok ? ab30.value.result.total : null },
        duplicateOwnerLookupMs: [authA.ms, authB.ms],
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
