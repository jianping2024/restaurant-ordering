#!/usr/bin/env node
/**
 * Copy menu (categories, items, images) from 巨好吃 / Restaurante Pirata → 白云餐厅.
 *
 * Usage: node scripts/copy-menu-to-baiyun.mjs [--env .env.local] [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE_ID = '19ad30c9-6c10-4845-8c89-583f3898274d';
const TARGET_ID = '88064a0b-1d36-4633-aa21-c928039e4f57';
const BAR_SRC = '9afa3554-ca41-412b-acde-064cef735cd9';
const BAR_TGT = 'fb0d1333-fdf4-4e55-92e9-ca1c9b984198';
const BUCKET = 'menu-images';

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

function remapStation(id) {
  if (!id) return null;
  if (id === BAR_SRC) return BAR_TGT;
  return id;
}

function storagePathFromUrl(imageUrl) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(imageUrl.slice(idx + marker.length));
}

function publicUrl(baseUrl, path) {
  return `${baseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function main() {
  const env = loadEnv(envFile);
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const [{ count: targetItems }, { data: categories, error: catErr }, { data: items, error: itemErr }] =
    await Promise.all([
      admin.from('menu_items').select('*', { count: 'exact', head: true }).eq('restaurant_id', TARGET_ID),
      admin.from('menu_categories').select('*').eq('restaurant_id', SOURCE_ID).order('sort_order'),
      admin.from('menu_items').select('*').eq('restaurant_id', SOURCE_ID).order('sort_order').order('created_at'),
    ]);

  if (catErr) throw catErr;
  if (itemErr) throw itemErr;
  if ((targetItems ?? 0) > 0) {
    throw new Error(`Target restaurant already has ${targetItems} menu items; aborting.`);
  }

  console.log(`Source: ${categories.length} categories, ${items.length} items`);
  if (dryRun) {
    console.log('Dry run — no writes.');
    return;
  }

  const catMap = new Map(categories.map((c) => [c.id, randomUUID()]));
  const itemMap = new Map(items.map((i) => [i.id, randomUUID()]));

  const newCategories = categories.map((c) => ({
    id: catMap.get(c.id),
    restaurant_id: TARGET_ID,
    parent_id: c.parent_id ? catMap.get(c.parent_id) ?? null : null,
    name_pt: c.name_pt,
    name_en: c.name_en,
    name_zh: c.name_zh,
    sort_order: c.sort_order,
    active: c.active,
    print_station_id: remapStation(c.print_station_id),
    item_code: c.item_code,
  }));

  const { error: insertCatErr } = await admin.from('menu_categories').insert(newCategories);
  if (insertCatErr) throw insertCatErr;
  console.log(`Inserted ${newCategories.length} categories`);

  const newItems = items.map((i) => ({
    id: itemMap.get(i.id),
    restaurant_id: TARGET_ID,
    name_pt: i.name_pt,
    name_en: i.name_en,
    name_zh: i.name_zh,
    description_pt: i.description_pt,
    description_en: i.description_en,
    price: i.price,
    vat_rate: i.vat_rate,
    category: i.category,
    emoji: i.emoji,
    available: i.available,
    sort_order: i.sort_order,
    image_url: null,
    note_preset_keys: i.note_preset_keys ?? [],
    category_en: i.category_en,
    category_zh: i.category_zh,
    category_id: i.category_id ? catMap.get(i.category_id) ?? null : null,
    print_station_id: remapStation(i.print_station_id),
    item_code: i.item_code,
  }));

  const { error: insertItemErr } = await admin.from('menu_items').insert(newItems);
  if (insertItemErr) throw insertItemErr;
  console.log(`Inserted ${newItems.length} menu items`);

  let copied = 0;
  let failed = 0;
  for (const item of items) {
    if (!item.image_url) continue;
    const srcPath = storagePathFromUrl(item.image_url);
    if (!srcPath) {
      failed += 1;
      continue;
    }
    const ext = srcPath.split('.').pop();
    const newId = itemMap.get(item.id);
    const dstPath = `${TARGET_ID}/${newId}.${ext}`;

    const { error: copyErr } = await admin.storage.from(BUCKET).copy(srcPath, dstPath);
    if (copyErr) {
      console.warn(`copy failed ${srcPath} → ${dstPath}: ${copyErr.message}`);
      failed += 1;
      continue;
    }

    const newUrl = publicUrl(env.NEXT_PUBLIC_SUPABASE_URL, dstPath);
    const { error: updErr } = await admin
      .from('menu_items')
      .update({ image_url: newUrl })
      .eq('id', newId);
    if (updErr) {
      console.warn(`url update failed for ${newId}: ${updErr.message}`);
      failed += 1;
      continue;
    }
    copied += 1;
    if (copied % 25 === 0) console.log(`  images ${copied}/${items.length}…`);
  }

  console.log(`Images copied: ${copied}, failed: ${failed}`);
  console.log('Done — 白云餐厅 menu ready.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
