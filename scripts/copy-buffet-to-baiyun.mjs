#!/usr/bin/env node
/**
 * Copy buffet settings (packages, time slots, calendar overrides, price rules,
 * buffet_friday_weekend_from) from Restaurante Pirata → 白云餐厅.
 * Does not copy users, staff, or operational data.
 *
 * Usage: node scripts/copy-buffet-to-baiyun.mjs [--env .env.local] [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE_ID = '19ad30c9-6c10-4845-8c89-583f3898274d';
const TARGET_ID = '88064a0b-1d36-4633-aa21-c928039e4f57';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const envFile = args.includes('--env') ? args[args.indexOf('--env') + 1] : '.env.local';

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

async function main() {
  const env = loadEnv(envFile);
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const [
    { data: sourceRestaurant, error: srcRestErr },
    { count: targetBuffets, error: tgtCountErr },
    { data: buffets, error: buffetErr },
    { data: timeSlots, error: slotErr },
    { data: calendarOverrides, error: calErr },
    { data: priceRules, error: ruleErr },
  ] = await Promise.all([
    admin
      .from('restaurants')
      .select('buffet_friday_weekend_from')
      .eq('id', SOURCE_ID)
      .single(),
    admin.from('buffets').select('*', { count: 'exact', head: true }).eq('restaurant_id', TARGET_ID),
    admin.from('buffets').select('*').eq('restaurant_id', SOURCE_ID).order('created_at'),
    admin.from('buffet_time_slots').select('*').eq('restaurant_id', SOURCE_ID).order('sort_order'),
    admin.from('buffet_calendar_overrides').select('*').eq('restaurant_id', SOURCE_ID).order('on_date'),
    admin.from('buffet_price_rules').select('*').eq('restaurant_id', SOURCE_ID).order('priority'),
  ]);

  if (srcRestErr) throw srcRestErr;
  if (tgtCountErr) throw tgtCountErr;
  if (buffetErr) throw buffetErr;
  if (slotErr) throw slotErr;
  if (calErr) throw calErr;
  if (ruleErr) throw ruleErr;
  if ((targetBuffets ?? 0) > 0) {
    throw new Error(`Target restaurant already has ${targetBuffets} buffets; aborting.`);
  }

  console.log(
    `Source: ${buffets.length} buffets, ${timeSlots.length} slots, ${calendarOverrides.length} calendar overrides, ${priceRules.length} price rules`,
  );
  console.log(`buffet_friday_weekend_from: ${sourceRestaurant.buffet_friday_weekend_from}`);

  if (dryRun) {
    console.log('Dry run — no writes.');
    return;
  }

  const buffetMap = new Map(buffets.map((b) => [b.id, randomUUID()]));
  const slotMap = new Map(timeSlots.map((s) => [s.id, randomUUID()]));

  const { error: restUpdErr } = await admin
    .from('restaurants')
    .update({ buffet_friday_weekend_from: sourceRestaurant.buffet_friday_weekend_from })
    .eq('id', TARGET_ID);
  if (restUpdErr) throw restUpdErr;
  console.log('Updated restaurant buffet_friday_weekend_from');

  if (buffets.length > 0) {
    const newBuffets = buffets.map((b) => ({
      id: buffetMap.get(b.id),
      restaurant_id: TARGET_ID,
      name: b.name,
      is_active: b.is_active,
      description: b.description,
    }));
    const { error: insertBuffetErr } = await admin.from('buffets').insert(newBuffets);
    if (insertBuffetErr) throw insertBuffetErr;
    console.log(`Inserted ${newBuffets.length} buffets`);
  }

  if (timeSlots.length > 0) {
    const newSlots = timeSlots.map((s) => ({
      id: slotMap.get(s.id),
      restaurant_id: TARGET_ID,
      name: s.name,
      start_time: s.start_time,
      end_time: s.end_time,
      weekdays: s.weekdays,
      sort_order: s.sort_order,
    }));
    const { error: insertSlotErr } = await admin.from('buffet_time_slots').insert(newSlots);
    if (insertSlotErr) throw insertSlotErr;
    console.log(`Inserted ${newSlots.length} time slots`);
  }

  if (calendarOverrides.length > 0) {
    const newOverrides = calendarOverrides.map((o) => ({
      restaurant_id: TARGET_ID,
      on_date: o.on_date,
      kind: o.kind,
    }));
    const { error: insertCalErr } = await admin.from('buffet_calendar_overrides').insert(newOverrides);
    if (insertCalErr) throw insertCalErr;
    console.log(`Inserted ${newOverrides.length} calendar overrides`);
  }

  if (priceRules.length > 0) {
    const newRules = priceRules.map((r) => ({
      id: randomUUID(),
      restaurant_id: TARGET_ID,
      buffet_id: buffetMap.get(r.buffet_id),
      time_slot_id: slotMap.get(r.time_slot_id),
      calendar_kind: r.calendar_kind,
      valid_from: r.valid_from,
      valid_to: r.valid_to,
      adult_price: r.adult_price,
      child_price: r.child_price,
      priority: r.priority,
      is_active: r.is_active,
      note: r.note,
    }));
    const { error: insertRuleErr } = await admin.from('buffet_price_rules').insert(newRules);
    if (insertRuleErr) throw insertRuleErr;
    console.log(`Inserted ${newRules.length} price rules`);
  }

  console.log('Done — 白云餐厅 buffet settings ready.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
