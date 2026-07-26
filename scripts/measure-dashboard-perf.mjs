#!/usr/bin/env node
/**
 * One-shot phase timing for dashboard overview + abnormal ops list (Approach A).
 * Usage: node scripts/measure-dashboard-perf.mjs [--env .env.local] [--slug restaurant-mohnrib5]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const envFile = args.includes('--env') ? args[args.indexOf('--env') + 1] : '.env.local';
const slug = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : 'restaurant-mohnrib5';

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(resolve(process.cwd(), path), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`Missing Supabase env in ${path}`);
  }
  return env;
}

function ms(start) {
  return Math.round(performance.now() - start);
}

async function timed(label, fn) {
  const start = performance.now();
  const value = await fn();
  return { label, ms: ms(start), value };
}

async function main() {
  const env = loadEnv(envFile);
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: restaurant, error: restErr } = await admin
    .from('restaurants')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle();
  if (restErr || !restaurant) {
    throw new Error(`restaurant not found for slug=${slug}: ${restErr?.message ?? 'missing'}`);
  }
  const restaurantId = restaurant.id;
  console.log(JSON.stringify({ restaurant: { id: restaurantId, slug: restaurant.slug, name: restaurant.name } }));

  const now = new Date();
  const sinceIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  // Lisbon day window approximate via existing service would be better; use UTC day for probe only
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  const startUtc = dayStart.toISOString();
  const endExclusiveUtc = dayEnd.toISOString();

  const printCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // --- Sequential phase timing (isolates each query) ---
  const sequential = [];
  sequential.push(
    await timed('today_orders_with_items', async () => {
      const { data, error } = await admin
        .from('orders')
        .select('id, status, items, total_amount')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startUtc)
        .lt('created_at', endExclusiveUtc);
      if (error) throw error;
      return { rows: data?.length ?? 0 };
    }),
  );
  sequential.push(
    await timed('recent_orders', async () => {
      const { data, error } = await admin
        .from('orders')
        .select('id, display_name, status, created_at, total_amount, items')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return { rows: data?.length ?? 0 };
    }),
  );
  sequential.push(
    await timed('in_progress_count', async () => {
      const { count, error } = await admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .neq('status', 'done');
      if (error) throw error;
      return { count };
    }),
  );
  sequential.push(
    await timed('pending_checkout_count', async () => {
      const { count, error } = await admin
        .from('bill_splits')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'requested');
      if (error) throw error;
      return { count };
    }),
  );
  sequential.push(
    await timed('pending_abnormal_count', async () => {
      const { count, error } = await admin
        .from('abnormal_operations')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'PENDING');
      if (error) throw error;
      return { count };
    }),
  );
  sequential.push(
    await timed('pending_print_count', async () => {
      const { count, error } = await admin
        .from('print_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .gte('created_at', printCutoff);
      if (error) throw error;
      return { count };
    }),
  );
  sequential.push(
    await timed('feedback_sessions_7d', async () => {
      const { data, error } = await admin
        .from('feedback_sessions')
        .select('session_id, completed_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', sinceIso);
      if (error) throw error;
      return { rows: data?.length ?? 0 };
    }),
  );
  sequential.push(
    await timed('billed_splits_7d', async () => {
      const { data, error } = await admin
        .from('bill_splits')
        .select('session_id')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', sinceIso)
        .not('session_id', 'is', null);
      if (error) throw error;
      return { rows: data?.length ?? 0 };
    }),
  );
  sequential.push(
    await timed('dish_feedback_7d_join', async () => {
      const { data, error } = await admin
        .from('dish_feedback')
        .select('menu_item_id, vote, reasons, menu_items(name_pt, name_en, name_zh)')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', sinceIso);
      if (error) throw error;
      return { rows: data?.length ?? 0 };
    }),
  );

  const sessionsStart = performance.now();
  const { data: sessions, error: sessErr } = await admin
    .from('table_sessions')
    .select('id, closed_at, closed_reason')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'closed')
    .not('closed_at', 'is', null)
    .gte('closed_at', startUtc)
    .lt('closed_at', endExclusiveUtc);
  if (sessErr) throw sessErr;
  const sessionIds = (sessions || []).map((s) => s.id);
  sequential.push({
    label: 'revenue_closed_sessions',
    ms: ms(sessionsStart),
    value: { rows: sessionIds.length },
  });

  if (sessionIds.length > 0) {
    const chunk = sessionIds.slice(0, 100);
    sequential.push(
      await timed('revenue_orders_by_session', async () => {
        const { data, error } = await admin
          .from('orders')
          .select('id, session_id, status, total_amount')
          .eq('restaurant_id', restaurantId)
          .in('session_id', chunk);
        if (error) throw error;
        return { rows: data?.length ?? 0 };
      }),
    );
    sequential.push(
      await timed('revenue_splits_by_session', async () => {
        const { data, error } = await admin
          .from('bill_splits')
          .select('id, session_id, status, result, total_amount, discount_rate')
          .eq('restaurant_id', restaurantId)
          .in('session_id', chunk);
        if (error) throw error;
        return { rows: data?.length ?? 0 };
      }),
    );
    sequential.push(
      await timed('revenue_unpaid_abnormal_by_session', async () => {
        const { data, error } = await admin
          .from('abnormal_operations')
          .select('session_id')
          .eq('restaurant_id', restaurantId)
          .eq('type', 'UNPAID_TABLE_CLOSED')
          .in('session_id', chunk);
        if (error) throw error;
        return { rows: data?.length ?? 0 };
      }),
    );
  }

  // Parallel wall time (mirrors overview Promise.all)
  const parallelStart = performance.now();
  await Promise.all([
    admin
      .from('orders')
      .select('id, status, items, total_amount')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', startUtc)
      .lt('created_at', endExclusiveUtc),
    admin
      .from('orders')
      .select('id, display_name, status, created_at, total_amount, items')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .neq('status', 'done'),
    admin
      .from('bill_splits')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'requested'),
    admin
      .from('abnormal_operations')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'PENDING'),
    admin
      .from('print_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'pending')
      .gte('created_at', printCutoff),
    admin
      .from('feedback_sessions')
      .select('session_id, completed_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', sinceIso),
    admin
      .from('bill_splits')
      .select('session_id')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', sinceIso)
      .not('session_id', 'is', null),
    admin
      .from('dish_feedback')
      .select('menu_item_id, vote, reasons, menu_items(name_pt, name_en, name_zh)')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', sinceIso),
    (async () => {
      const { data: sess } = await admin
        .from('table_sessions')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'closed')
        .not('closed_at', 'is', null)
        .gte('closed_at', startUtc)
        .lt('closed_at', endExclusiveUtc);
      const ids = (sess || []).map((s) => s.id);
      if (ids.length === 0) return;
      const c = ids.slice(0, 100);
      await Promise.all([
        admin.from('orders').select('id, session_id, status, total_amount').eq('restaurant_id', restaurantId).in('session_id', c),
        admin
          .from('bill_splits')
          .select('id, session_id, status, result, total_amount, discount_rate')
          .eq('restaurant_id', restaurantId)
          .in('session_id', c),
        admin
          .from('abnormal_operations')
          .select('session_id')
          .eq('restaurant_id', restaurantId)
          .eq('type', 'UNPAID_TABLE_CLOSED')
          .in('session_id', c),
      ]);
    })(),
  ]);
  const overviewParallelMs = ms(parallelStart);

  // Abnormal list: full fetch today / 7d / 30d
  const today = now.toISOString().slice(0, 10);
  async function abnormalFull(label, startDate, endDate) {
    const start = performance.now();
    const startUtcIso = `${startDate}T00:00:00.000Z`;
    const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const { data, error } = await admin
      .from('abnormal_operations')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', startUtcIso)
      .lt('created_at', endExclusive.toISOString());
    if (error) throw error;
    return { label, ms: ms(start), rows: data?.length ?? 0 };
  }

  const d = (offset) => {
    const x = new Date(now);
    x.setUTCDate(x.getUTCDate() + offset);
    return x.toISOString().slice(0, 10);
  };

  const abnormal = [
    await abnormalFull('abnormal_select_star_today', today, today),
    await abnormalFull('abnormal_select_star_7d', d(-6), today),
    await abnormalFull('abnormal_select_star_30d', d(-29), today),
  ];

  // Page-sized select (proposed shape) for 30d
  const pageStart = performance.now();
  {
    const startDate = d(-29);
    const startUtcIso = `${startDate}T00:00:00.000Z`;
    const endExclusive = new Date(`${today}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const { data, error, count } = await admin
      .from('abnormal_operations')
      .select('id, type, risk_level, status, amount_impact, created_at', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .gte('created_at', startUtcIso)
      .lt('created_at', endExclusive.toISOString())
      .order('created_at', { ascending: false })
      .range(0, 19);
    if (error) throw error;
    abnormal.push({
      label: 'abnormal_page_20_light_cols_30d',
      ms: ms(pageStart),
      rows: data?.length ?? 0,
      total: count,
    });
  }

  sequential.sort((a, b) => b.ms - a.ms);
  console.log(
    JSON.stringify(
      {
        overviewParallelMs,
        sequentialRanked: sequential.map(({ label, ms: t, value }) => ({ label, ms: t, ...value })),
        abnormal,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
