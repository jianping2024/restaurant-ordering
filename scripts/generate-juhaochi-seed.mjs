#!/usr/bin/env node
/**
 * Regenerate supabase/seed.sql from scripts/seed-data/juhaochi-payload.json
 * (exported from linked cloud: 巨好吃餐厅 menu + owner; no orders).
 *
 * Refresh payload:
 *   supabase db query --linked -o json "SELECT json_build_object(
 *     'restaurant', (SELECT row_to_json(t) FROM public.restaurants t WHERE slug = 'restaurant-mo9y14xc'),
 *     'print_stations', (SELECT coalesce(json_agg(row_to_json(ps) ORDER BY sort_order, created_at), '[]'::json) FROM public.print_stations ps WHERE restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'restaurant-mo9y14xc')),
 *     'menu_categories', (SELECT coalesce(json_agg(row_to_json(mc) ORDER BY sort_order), '[]'::json) FROM public.menu_categories mc WHERE restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'restaurant-mo9y14xc')),
 *     'menu_items', (SELECT coalesce(json_agg(row_to_json(mi) ORDER BY sort_order, created_at), '[]'::json) FROM public.menu_items mi WHERE restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'restaurant-mo9y14xc'))
 *   ) AS payload;" > /tmp/out.json
 * Then copy rows[0].payload into scripts/seed-data/juhaochi-payload.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const payloadPath = path.join(__dirname, 'seed-data', 'juhaochi-payload.json');
const outPath = path.join(root, 'supabase', 'seed.sql');

const DEV_EMAIL = 'dev-owner@local.test';
const DEV_PASSWORD = 'localdev123';
const OWNER_ID = '40bb02de-21e0-47e7-a3d6-caab3d8bb059';
const IDENTITY_ID = '2b9b01e9-f5b2-4b88-a2cc-afc5c4a0423e';

const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
const { restaurant, print_stations, menu_categories, menu_items } = payload;

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function lit(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return `'${esc(JSON.stringify(val))}'::jsonb`;
  return `'${esc(val)}'`;
}

function textArray(keys) {
  if (!keys?.length) return 'ARRAY[]::text[]';
  return `ARRAY[${keys.map((k) => `'${esc(k)}'`).join(', ')}]::text[]`;
}

const lines = [];
lines.push(`-- Local dev seed: 巨好吃餐厅 (menu snapshot from cloud; no orders/sessions).`);
lines.push(`-- Login: ${DEV_EMAIL} / ${DEV_PASSWORD}`);
lines.push(`-- Regenerate: node scripts/generate-juhaochi-seed.mjs`);
lines.push('');

lines.push('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;');
lines.push('');

lines.push('DO $$');
lines.push('DECLARE');
lines.push(`  v_pw text := crypt('${esc(DEV_PASSWORD)}', gen_salt('bf'));`);
lines.push('BEGIN');
lines.push(`  DELETE FROM auth.identities WHERE user_id = '${OWNER_ID}';`);
lines.push(`  DELETE FROM auth.users WHERE id = '${OWNER_ID}';`);
lines.push('');
lines.push('  INSERT INTO auth.users (');
lines.push('    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,');
lines.push('    raw_app_meta_data, raw_user_meta_data, created_at, updated_at');
lines.push('  ) VALUES (');
lines.push(`    '${OWNER_ID}',`);
lines.push("    '00000000-0000-0000-0000-000000000000',");
lines.push("    'authenticated', 'authenticated',");
lines.push(`    '${DEV_EMAIL}', v_pw, NOW(),`);
lines.push(`    '{"provider":"email","providers":["email"]}'::jsonb,`);
lines.push(`    jsonb_build_object('email', '${DEV_EMAIL}', 'email_verified', true, 'sub', '${OWNER_ID}'),`);
lines.push('    NOW(), NOW()');
lines.push('  );');
lines.push('');
lines.push('  INSERT INTO auth.identities (');
lines.push('    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at');
lines.push('  ) VALUES (');
lines.push(`    '${IDENTITY_ID}', '${OWNER_ID}',`);
lines.push(
  `    jsonb_build_object('sub', '${OWNER_ID}', 'email', '${DEV_EMAIL}', 'email_verified', true),`,
);
lines.push(`    'email', '${OWNER_ID}', NOW(), NOW(), NOW());`);
lines.push('END $$;');
lines.push('');

const r = restaurant;
lines.push('INSERT INTO public.restaurants (');
lines.push(
  '  id, name, slug, owner_id, logo_url, address, phone, plan, kitchen_password, waiter_password,',
);
lines.push(
  '  geo_latitude, geo_longitude, print_locale, print_agent_config, kitchen_password_version, waiter_password_version,',
);
lines.push('  order_radius_meters, buffet_friday_weekend_from');
lines.push(') VALUES (');
lines.push(
  `  ${lit(r.id)}, ${lit(r.name)}, ${lit(r.slug)}, ${lit(r.owner_id)}, ${lit(r.logo_url)}, ${lit(r.address)}, ${lit(r.phone)}, ${lit(r.plan)},`,
);
lines.push(
  `  ${lit(r.kitchen_password)}, ${lit(r.waiter_password)}, ${lit(r.geo_latitude)}, ${lit(r.geo_longitude)}, ${lit(r.print_locale)}, ${lit(r.print_agent_config)},`,
);
lines.push(
  `  ${lit(r.kitchen_password_version)}, ${lit(r.waiter_password_version)}, ${lit(r.order_radius_meters)}, ${lit(r.buffet_friday_weekend_from)}`,
);
lines.push(') ON CONFLICT (id) DO UPDATE SET');
lines.push(
  '  name = EXCLUDED.name, slug = EXCLUDED.slug, owner_id = EXCLUDED.owner_id, kitchen_password = EXCLUDED.kitchen_password,',
);
lines.push(
  '  waiter_password = EXCLUDED.waiter_password, print_locale = EXCLUDED.print_locale, print_agent_config = EXCLUDED.print_agent_config,',
);
lines.push(
  '  kitchen_password_version = EXCLUDED.kitchen_password_version, waiter_password_version = EXCLUDED.waiter_password_version,',
);
lines.push('  order_radius_meters = EXCLUDED.order_radius_meters, buffet_friday_weekend_from = EXCLUDED.buffet_friday_weekend_from;');
lines.push('');

lines.push(`DELETE FROM public.print_stations WHERE restaurant_id = ${lit(r.id)};`);
lines.push(`DELETE FROM public.restaurant_tables WHERE restaurant_id = ${lit(r.id)};`);
lines.push('');

for (const ps of print_stations) {
  lines.push(
    `INSERT INTO public.print_stations (id, restaurant_id, name_pt, name_en, name_zh, sort_order, ticket_layout, created_at) VALUES (${lit(ps.id)}, ${lit(ps.restaurant_id)}, ${lit(ps.name_pt)}, ${lit(ps.name_en)}, ${lit(ps.name_zh)}, ${lit(ps.sort_order)}, ${lit(ps.ticket_layout)}, ${lit(ps.created_at)}) ON CONFLICT (id) DO NOTHING;`,
  );
}
lines.push('');

for (const mc of menu_categories) {
  lines.push(
    `INSERT INTO public.menu_categories (id, restaurant_id, parent_id, name_pt, name_en, name_zh, sort_order, active, print_station_id, item_code, created_at) VALUES (${lit(mc.id)}, ${lit(mc.restaurant_id)}, ${lit(mc.parent_id)}, ${lit(mc.name_pt)}, ${lit(mc.name_en)}, ${lit(mc.name_zh)}, ${lit(mc.sort_order)}, ${lit(mc.active)}, ${lit(mc.print_station_id)}, ${lit(mc.item_code)}, ${lit(mc.created_at)}) ON CONFLICT (id) DO NOTHING;`,
  );
}
lines.push('');

for (const mi of menu_items) {
  lines.push(
    `INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES (${lit(mi.id)}, ${lit(mi.restaurant_id)}, ${lit(mi.name_pt)}, ${lit(mi.name_en)}, ${lit(mi.name_zh)}, ${lit(mi.description_pt)}, ${lit(mi.description_en)}, ${lit(mi.price)}, ${lit(mi.category)}, ${lit(mi.emoji)}, ${lit(mi.available)}, ${lit(mi.sort_order)}, ${lit(mi.image_url)}, ${textArray(mi.note_preset_keys)}, ${lit(mi.category_en)}, ${lit(mi.category_zh)}, ${lit(mi.category_id)}, ${lit(mi.print_station_id)}, ${lit(mi.item_code)}, ${lit(mi.created_at)}) ON CONFLICT (id) DO NOTHING;`,
  );
}

const sql = `${lines.join('\n')}\n`;
fs.writeFileSync(outPath, sql);
console.log(`Wrote ${outPath} (${menu_items.length} items, ${menu_categories.length} categories)`);
