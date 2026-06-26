#!/usr/bin/env node
/**
 * Seed qualifying closed sessions for value analytics demo (production/stage).
 * Tags rows with closed_reason = va_demo_seed for cleanup.
 *
 * Usage:
 *   node scripts/seed-value-analytics-demo.mjs [--env .env.local] [--restaurant-id UUID] [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEMO_TAG = 'va_demo_seed';
const DEFAULT_RESTAURANT_ID = '19ad30c9-6c10-4845-8c89-583f3898274d';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const envFile = args.includes('--env') ? args[args.indexOf('--env') + 1] : '.env.local';
const restaurantId = args.includes('--restaurant-id')
  ? args[args.indexOf('--restaurant-id') + 1]
  : DEFAULT_RESTAURANT_ID;

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

/** Lisbon calendar date + evening close hour → UTC ISO */
function lisbonCloseIso(dateStr, hour = 21, minute = 30) {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Lisbon',
    timeZoneName: 'shortOffset',
  }).formatToParts(probe);
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0';
  const m = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = m?.[1] === '-' ? -1 : 1;
  const offH = Number(m?.[2] ?? 0);
  const offM = Number(m?.[3] ?? 0);
  const offsetMin = sign * (offH * 60 + offM);
  const utcMs = Date.UTC(
    Number(dateStr.slice(0, 4)),
    Number(dateStr.slice(5, 7)) - 1,
    Number(dateStr.slice(8, 10)),
    hour,
    minute,
  ) - offsetMin * 60_000;
  return new Date(utcMs).toISOString();
}

function addCalendarDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function calendarTodayLisbon() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const DAY_PLAN = [
  { revenue: 86.5, adults: 2, children: 1, colaQty: 2, drinkQty: 1 },
  { revenue: 142.0, adults: 4, children: 0, colaQty: 3, drinkQty: 2 },
  { revenue: 58.0, adults: 1, children: 0, colaQty: 1, drinkQty: 1 },
  { revenue: 198.5, adults: 3, children: 2, colaQty: 4, drinkQty: 3 },
  { revenue: 124.0, adults: 2, children: 1, colaQty: 2, drinkQty: 2 },
  { revenue: 231.0, adults: 5, children: 1, colaQty: 5, drinkQty: 2 },
  { revenue: 167.5, adults: 3, children: 0, colaQty: 3, drinkQty: 2 },
  { revenue: 95.0, adults: 2, children: 0, colaQty: 2, drinkQty: 1 },
  { revenue: 176.0, adults: 4, children: 1, colaQty: 3, drinkQty: 2 },
  { revenue: 112.5, adults: 2, children: 2, colaQty: 2, drinkQty: 1 },
];

async function main() {
  const env = loadEnv(envFile);
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: restaurant, error: rErr } = await admin
    .from('restaurants')
    .select('id, name, owner_id')
    .eq('id', restaurantId)
    .single();
  if (rErr || !restaurant) throw new Error(`Restaurant not found: ${restaurantId}`);

  const { data: tables } = await admin
    .from('restaurant_tables')
    .select('id, display_name')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('sort_order')
    .limit(10);
  if (!tables?.length) throw new Error('No tables for restaurant');

  const { data: menuItems } = await admin
    .from('menu_items')
    .select('id, name_pt, name_zh, name_en, price, emoji, category, category_en, category_zh')
    .eq('restaurant_id', restaurantId)
    .eq('available', true)
    .order('sort_order')
    .limit(20);
  if (!menuItems?.length) throw new Error('No menu items for restaurant');

  const cola = menuItems.find((m) => /cola/i.test(m.name_pt)) ?? menuItems[0];
  const drink = menuItems.find((m) => m.id !== cola.id) ?? menuItems[1] ?? cola;

  const today = calendarTodayLisbon();
  const fixtures = DAY_PLAN.map((plan, i) => {
    const dayOffset = -(DAY_PLAN.length - 1 - i);
    const dateStr = addCalendarDays(today, dayOffset);
    const table = tables[i % tables.length];
    const sessionId = randomUUID();
    const orderId = randomUUID();
    const splitId = randomUUID();
    const closedAt = lisbonCloseIso(dateStr);

    const colaLine = {
      id: cola.id,
      name_pt: cola.name_pt,
      name: cola.name_pt,
      qty: plan.colaQty,
      price: Number(cola.price),
      emoji: cola.emoji ?? '🍺',
    };
    const drinkLine = {
      id: drink.id,
      name_pt: drink.name_pt,
      name: drink.name_pt,
      qty: plan.drinkQty,
      price: Number(drink.price),
      emoji: drink.emoji ?? '🍽',
    };
    const buffetLine = {
      id: `buffet-demo-${i}`,
      kind: 'buffet_base',
      buffet_id: 'demo-buffet',
      adult_count: plan.adults,
      child_count: plan.children,
      name_pt: 'Buffet',
      name: 'Buffet',
      qty: 1,
      price: Math.max(0, plan.revenue - plan.colaQty * Number(cola.price) - plan.drinkQty * Number(drink.price)),
      emoji: '🍽',
      added_at: closedAt,
    };

    return {
      sessionId,
      orderId,
      splitId,
      table,
      closedAt,
      plan,
      items: [buffetLine, colaLine, drinkLine],
    };
  });

  console.log(`Restaurant: ${restaurant.name} (${restaurant.id})`);
  console.log(`Sessions to insert: ${fixtures.length}${dryRun ? ' [dry-run]' : ''}`);

  if (dryRun) {
    for (const f of fixtures) {
      console.log(`  ${f.closedAt.slice(0, 10)} €${f.plan.revenue} table ${f.table.display_name}`);
    }
    return;
  }

  const ownerId = restaurant.owner_id;

  for (const f of fixtures) {
    const { error: sErr } = await admin.from('table_sessions').insert({
      id: f.sessionId,
      restaurant_id: restaurantId,
      table_id: f.table.id,
      status: 'closed',
      opened_at: f.closedAt,
      closed_at: f.closedAt,
      opened_by_user_id: ownerId,
      closed_by_user_id: ownerId,
      closed_reason: DEMO_TAG,
    });
    if (sErr) throw new Error(`session ${f.sessionId}: ${sErr.message}`);

    const { error: oErr } = await admin.from('orders').insert({
      id: f.orderId,
      restaurant_id: restaurantId,
      table_id: f.table.id,
      display_name: f.table.display_name,
      session_id: f.sessionId,
      status: 'done',
      total_amount: f.plan.revenue,
      items: f.items,
      created_at: f.closedAt,
      updated_at: f.closedAt,
    });
    if (oErr) {
      await admin.from('table_sessions').delete().eq('id', f.sessionId);
      throw new Error(`order ${f.orderId}: ${oErr.message}`);
    }

    const half = Math.round((f.plan.revenue / 2) * 100) / 100;
    const rest = Math.round((f.plan.revenue - half) * 100) / 100;
    const { error: bErr } = await admin.from('bill_splits').insert({
      id: f.splitId,
      restaurant_id: restaurantId,
      table_id: f.table.id,
      display_name: f.table.display_name,
      session_id: f.sessionId,
      order_ids: [f.orderId],
      split_mode: 'even',
      persons: [],
      result: [
        { name: 'Guest A', amount: half, paid: true },
        { name: 'Guest B', amount: rest, paid: true },
      ],
      total_amount: f.plan.revenue,
      status: 'paid',
      created_at: f.closedAt,
    });
    if (bErr) {
      await admin.from('orders').delete().eq('id', f.orderId);
      await admin.from('table_sessions').delete().eq('id', f.sessionId);
      throw new Error(`split ${f.splitId}: ${bErr.message}`);
    }
  }

  const totalRevenue = fixtures.reduce((s, f) => s + f.plan.revenue, 0);
  console.log(`Done. Inserted ${fixtures.length} demo sessions, total revenue €${totalRevenue.toFixed(2)}`);
  console.log(`Cleanup: DELETE sessions/orders/splits where closed_reason = '${DEMO_TAG}' or tag sessions by id.`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
