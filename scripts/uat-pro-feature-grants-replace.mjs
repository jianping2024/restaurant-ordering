#!/usr/bin/env node
/**
 * Local UAT: sole replaceRestaurantProFeatureGrants round-trip against Docker Supabase.
 * Restores prior grants on exit.
 *
 * Usage (from repo root, env loaded like web):
 *   node --import tsx scripts/uat-pro-feature-grants-replace.mjs
 */
import { createClient } from '@supabase/supabase-js';
import {
  loadRestaurantProFeatureGrantKeys,
  replaceRestaurantProFeatureGrants,
} from '../packages/shared/src/pro-feature-grants.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.MESA_SUPABASE_SERVICE_ROLE_KEY ||
  '';
if (!key) {
  console.error('missing_service_role_key');
  process.exit(2);
}

const slug = process.env.MESA_UAT_SLUG || 'restaurant-mohnrib5';
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: rest, error: restErr } = await admin
  .from('restaurants')
  .select('id, slug, plan')
  .eq('slug', slug)
  .maybeSingle();
if (restErr || !rest) {
  console.error('restaurant_missing', restErr?.message || slug);
  process.exit(1);
}

const before = await loadRestaurantProFeatureGrantKeys(admin, rest.id);
console.log(JSON.stringify({ step: 'before', slug, plan: rest.plan, keys: before }));

const midKeys = ['menu_dish_video', 'menu_dish_list_video', 'value_analytics'];
const mid = await replaceRestaurantProFeatureGrants(admin, rest.id, midKeys);
if (!mid.ok) {
  console.error('replace_mid_failed', mid);
  process.exit(1);
}
const midLoaded = await loadRestaurantProFeatureGrantKeys(admin, rest.id);
const midOk =
  midLoaded.includes('menu_dish_video') &&
  midLoaded.includes('menu_dish_list_video') &&
  midLoaded.includes('value_analytics') &&
  !midLoaded.includes('abnormal_ops');
console.log(JSON.stringify({ step: 'mid', ok: midOk, keys: midLoaded }));

const restored = await replaceRestaurantProFeatureGrants(admin, rest.id, before);
if (!restored.ok) {
  console.error('restore_failed', restored);
  process.exit(1);
}
const after = await loadRestaurantProFeatureGrantKeys(admin, rest.id);
const restoreOk = JSON.stringify(after) === JSON.stringify(before);
console.log(JSON.stringify({ step: 'restored', ok: restoreOk, keys: after }));

if (!midOk || !restoreOk) process.exit(1);
console.log('uat_pro_feature_grants_replace_pass');
