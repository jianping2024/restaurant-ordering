#!/usr/bin/env node
/**
 * Export / import restaurant catalog (buffet, menu+images, tables+groups, print stations).
 *
 * Export (Mac local Docker Pirata):
 *   node scripts/restaurant-catalog-transfer.mjs export \
 *     --env .env.local.dev \
 *     --restaurant-id 19ad30c9-6c10-4845-8c89-583f3898274d \
 *     --out dist/pirata-catalog
 *
 * Import (on store, after scp pack):
 *   node scripts/restaurant-catalog-transfer.mjs import \
 *     --env /opt/mesa/current/.env \
 *     --target-id cc376f44-e9a9-445f-a5b1-11c725eda5f2 \
 *     --pack dist/pirata-catalog \
 *     --replace-tables
 *
 * Options: --dry-run  --force (allow non-empty menu/buffet on target)
 */
import { createClient } from '@supabase/supabase-js';
import { menuImageSameOriginEnabled, toMenuImagePublicRef } from '@mesa/shared';
import { randomUUID } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const BUCKET = 'menu-images';

const args = process.argv.slice(2);
const command = args[0];
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const replaceTables = args.includes('--replace-tables');

function flagValue(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(resolve(process.cwd(), path), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY && env.SERVICE_ROLE_KEY) {
    env.SUPABASE_SERVICE_ROLE_KEY = env.SERVICE_ROLE_KEY;
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL && env.API_URL) {
    env.NEXT_PUBLIC_SUPABASE_URL = env.API_URL;
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      `Missing NEXT_PUBLIC_SUPABASE_URL (or API_URL) / SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY) in ${path}`,
    );
  }
  return env;
}

function adminClient(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function storagePathFromUrl(imageUrl) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(imageUrl.slice(idx + marker.length));
}

/** Same contract as apps/web `toMenuImagePublicRef` — shared formatter only. */
function menuImagePublicRefForEnv(env, objectPath) {
  const publishedOrigin =
    (env.SUPABASE_PUBLIC_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  return toMenuImagePublicRef(objectPath, {
    sameOrigin: menuImageSameOriginEnabled(env),
    publishedOrigin,
  });
}

function writeJson(dir, name, data) {
  writeFileSync(join(dir, name), `${JSON.stringify(data, null, 2)}\n`);
}

function readJson(dir, name) {
  return JSON.parse(readFileSync(join(dir, name), 'utf8'));
}

async function must(label, result) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function exportCatalog() {
  const envPath = flagValue('--env') || '.env.local.dev';
  const restaurantId = flagValue('--restaurant-id');
  const outDir = resolve(process.cwd(), flagValue('--out') || 'dist/pirata-catalog');
  if (!restaurantId) throw new Error('export requires --restaurant-id');

  const env = loadEnv(envPath);
  const admin = adminClient(env);

  const restaurant = await must(
    'restaurant',
    await admin
      .from('restaurants')
      .select('id, name, slug, buffet_friday_weekend_from')
      .eq('id', restaurantId)
      .single(),
  );

  const [
    printStations,
    buffets,
    timeSlots,
    calendarOverrides,
    priceRules,
    categories,
    items,
    tables,
    groups,
    groupMembers,
  ] = await Promise.all([
    must(
      'print_stations',
      await admin.from('print_stations').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
    ),
    must('buffets', await admin.from('buffets').select('*').eq('restaurant_id', restaurantId).order('created_at')),
    must(
      'buffet_time_slots',
      await admin.from('buffet_time_slots').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
    ),
    must(
      'buffet_calendar_overrides',
      await admin
        .from('buffet_calendar_overrides')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('on_date'),
    ),
    must(
      'buffet_price_rules',
      await admin.from('buffet_price_rules').select('*').eq('restaurant_id', restaurantId).order('priority'),
    ),
    must(
      'menu_categories',
      await admin.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
    ),
    must(
      'menu_items',
      await admin
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order')
        .order('created_at'),
    ),
    must(
      'restaurant_tables',
      await admin
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('sort_order'),
    ),
    must(
      'restaurant_table_groups',
      await admin
        .from('restaurant_table_groups')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order'),
    ),
    must(
      'restaurant_table_group_members',
      await admin.from('restaurant_table_group_members').select('*').eq('restaurant_id', restaurantId),
    ),
  ]);

  mkdirSync(outDir, { recursive: true });
  const imagesDir = join(outDir, 'images');
  mkdirSync(imagesDir, { recursive: true });

  const manifest = {
    exported_at: new Date().toISOString(),
    source: restaurant,
    counts: {
      print_stations: printStations.length,
      buffets: buffets.length,
      buffet_time_slots: timeSlots.length,
      buffet_calendar_overrides: calendarOverrides.length,
      buffet_price_rules: priceRules.length,
      menu_categories: categories.length,
      menu_items: items.length,
      restaurant_tables: tables.length,
      restaurant_table_groups: groups.length,
      restaurant_table_group_members: groupMembers.length,
    },
  };

  writeJson(outDir, 'manifest.json', manifest);
  writeJson(outDir, 'print_stations.json', printStations);
  writeJson(outDir, 'buffets.json', buffets);
  writeJson(outDir, 'buffet_time_slots.json', timeSlots);
  writeJson(outDir, 'buffet_calendar_overrides.json', calendarOverrides);
  writeJson(outDir, 'buffet_price_rules.json', priceRules);
  writeJson(outDir, 'menu_categories.json', categories);
  writeJson(outDir, 'menu_items.json', items);
  writeJson(outDir, 'restaurant_tables.json', tables);
  writeJson(outDir, 'restaurant_table_groups.json', groups);
  writeJson(outDir, 'restaurant_table_group_members.json', groupMembers);

  let imagesOk = 0;
  let imagesFail = 0;
  for (const item of items) {
    if (!item.image_url) continue;
    const srcPath = storagePathFromUrl(item.image_url);
    if (!srcPath) {
      imagesFail += 1;
      continue;
    }
    const { data, error } = await admin.storage.from(BUCKET).download(srcPath);
    if (error || !data) {
      console.warn(`image download failed ${srcPath}: ${error?.message ?? 'empty'}`);
      imagesFail += 1;
      continue;
    }
    const ext = srcPath.split('.').pop() || 'jpg';
    const filePath = join(imagesDir, `${item.id}.${ext}`);
    if (!dryRun) {
      await pipeline(Readable.fromWeb(data.stream()), createWriteStream(filePath));
    }
    imagesOk += 1;
    if (imagesOk % 25 === 0) console.log(`  images ${imagesOk}…`);
  }

  console.log(JSON.stringify(manifest.counts, null, 2));
  console.log(`Images downloaded: ${imagesOk}, failed: ${imagesFail}`);
  console.log(`Pack written to ${outDir}${dryRun ? ' (dry-run: images skipped write)' : ''}`);
}

async function importCatalog() {
  const envPath = flagValue('--env');
  const targetId = flagValue('--target-id');
  const packDir = resolve(process.cwd(), flagValue('--pack') || 'dist/pirata-catalog');
  if (!envPath) throw new Error('import requires --env (store env with service role)');
  if (!targetId) throw new Error('import requires --target-id');
  if (!replaceTables) {
    throw new Error('import requires --replace-tables (soft-delete target active tables first)');
  }
  if (!existsSync(join(packDir, 'manifest.json'))) {
    throw new Error(`pack not found: ${packDir}`);
  }

  const env = loadEnv(envPath);
  const admin = adminClient(env);
  const manifest = readJson(packDir, 'manifest.json');

  const target = await must(
    'target restaurant',
    await admin.from('restaurants').select('id, name, slug').eq('id', targetId).single(),
  );

  const [{ count: menuCount }, { count: buffetCount }, { count: activeTables }] = await Promise.all([
    admin.from('menu_items').select('*', { count: 'exact', head: true }).eq('restaurant_id', targetId),
    admin.from('buffets').select('*', { count: 'exact', head: true }).eq('restaurant_id', targetId),
    admin
      .from('restaurant_tables')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', targetId)
      .is('deleted_at', null),
  ]);

  if (!force && ((menuCount ?? 0) > 0 || (buffetCount ?? 0) > 0)) {
    throw new Error(
      `Target already has menu_items=${menuCount} buffets=${buffetCount}; use --force to override`,
    );
  }

  console.log(`Target: ${target.name} (${target.slug}) ${targetId}`);
  console.log(`Source pack: ${manifest.source?.name} @ ${manifest.exported_at}`);
  console.log(`Active tables on target before replace: ${activeTables ?? 0}`);
  console.log(JSON.stringify(manifest.counts, null, 2));

  if (dryRun) {
    console.log('Dry run — no writes.');
    return;
  }

  const printStations = readJson(packDir, 'print_stations.json');
  const buffets = readJson(packDir, 'buffets.json');
  const timeSlots = readJson(packDir, 'buffet_time_slots.json');
  const calendarOverrides = readJson(packDir, 'buffet_calendar_overrides.json');
  const priceRules = readJson(packDir, 'buffet_price_rules.json');
  const categories = readJson(packDir, 'menu_categories.json');
  const items = readJson(packDir, 'menu_items.json');
  const tables = readJson(packDir, 'restaurant_tables.json');
  const groups = readJson(packDir, 'restaurant_table_groups.json');
  const groupMembers = readJson(packDir, 'restaurant_table_group_members.json');

  // --- print stations: match by name_pt, else create ---
  const existingStations = await must(
    'existing stations',
    await admin.from('print_stations').select('*').eq('restaurant_id', targetId),
  );
  const stationMap = new Map();
  for (const src of printStations) {
    const hit = existingStations.find(
      (s) => (s.name_pt || '').toLowerCase() === (src.name_pt || '').toLowerCase(),
    );
    if (hit) {
      stationMap.set(src.id, hit.id);
      continue;
    }
    const newId = randomUUID();
    const { error } = await admin.from('print_stations').insert({
      id: newId,
      restaurant_id: targetId,
      name_pt: src.name_pt,
      name_en: src.name_en,
      name_zh: src.name_zh,
      sort_order: src.sort_order,
    });
    if (error) throw new Error(`print_stations insert: ${error.message}`);
    stationMap.set(src.id, newId);
    existingStations.push({ id: newId, name_pt: src.name_pt });
  }
  console.log(`Print stations mapped: ${stationMap.size}`);

  // --- replace tables ---
  const { data: oldMembers, error: oldMemErr } = await admin
    .from('restaurant_table_group_members')
    .select('group_id, table_id')
    .eq('restaurant_id', targetId);
  if (oldMemErr) throw oldMemErr;
  if (oldMembers?.length) {
    const { error } = await admin
      .from('restaurant_table_group_members')
      .delete()
      .eq('restaurant_id', targetId);
    if (error) throw new Error(`delete group members: ${error.message}`);
  }
  const { error: delGroupsErr } = await admin
    .from('restaurant_table_groups')
    .delete()
    .eq('restaurant_id', targetId);
  if (delGroupsErr) throw new Error(`delete table groups: ${delGroupsErr.message}`);

  const { error: softDelErr } = await admin
    .from('restaurant_tables')
    .update({ deleted_at: new Date().toISOString() })
    .eq('restaurant_id', targetId)
    .is('deleted_at', null);
  if (softDelErr) throw new Error(`soft-delete tables: ${softDelErr.message}`);
  console.log('Soft-deleted existing active tables; cleared groups');

  const tableMap = new Map(tables.map((t) => [t.id, randomUUID()]));
  const groupMap = new Map(groups.map((g) => [g.id, randomUUID()]));

  const newTables = tables.map((t) => ({
    id: tableMap.get(t.id),
    restaurant_id: targetId,
    display_name: t.display_name,
    sort_order: t.sort_order,
    seat_min: t.seat_min,
    seat_max: t.seat_max,
    deleted_at: null,
  }));
  // chunk inserts
  for (let i = 0; i < newTables.length; i += 100) {
    const chunk = newTables.slice(i, i + 100);
    const { error } = await admin.from('restaurant_tables').insert(chunk);
    if (error) throw new Error(`restaurant_tables insert: ${error.message}`);
  }
  console.log(`Inserted ${newTables.length} tables`);

  if (groups.length) {
    const newGroups = groups.map((g) => ({
      id: groupMap.get(g.id),
      restaurant_id: targetId,
      name: g.name,
      remarks: g.remarks ?? null,
      sort_order: g.sort_order,
    }));
    const { error } = await admin.from('restaurant_table_groups').insert(newGroups);
    if (error) throw new Error(`restaurant_table_groups insert: ${error.message}`);
    console.log(`Inserted ${newGroups.length} table groups`);
  }

  const newMembers = groupMembers
    .filter((m) => tableMap.has(m.table_id) && groupMap.has(m.group_id))
    .map((m) => ({
      group_id: groupMap.get(m.group_id),
      table_id: tableMap.get(m.table_id),
      restaurant_id: targetId,
    }));
  if (newMembers.length) {
    for (let i = 0; i < newMembers.length; i += 200) {
      const chunk = newMembers.slice(i, i + 200);
      const { error } = await admin.from('restaurant_table_group_members').insert(chunk);
      if (error) throw new Error(`group members insert: ${error.message}`);
    }
    console.log(`Inserted ${newMembers.length} group members`);
  }

  // --- buffet ---
  const { error: restUpdErr } = await admin
    .from('restaurants')
    .update({ buffet_friday_weekend_from: manifest.source?.buffet_friday_weekend_from ?? null })
    .eq('id', targetId);
  if (restUpdErr) throw new Error(`restaurant buffet flag: ${restUpdErr.message}`);

  const buffetMap = new Map(buffets.map((b) => [b.id, randomUUID()]));
  const slotMap = new Map(timeSlots.map((s) => [s.id, randomUUID()]));

  if (buffets.length) {
    const { error } = await admin.from('buffets').insert(
      buffets.map((b) => ({
        id: buffetMap.get(b.id),
        restaurant_id: targetId,
        name: b.name,
        is_active: b.is_active,
        description: b.description,
      })),
    );
    if (error) throw new Error(`buffets: ${error.message}`);
    console.log(`Inserted ${buffets.length} buffets`);
  }
  if (timeSlots.length) {
    const { error } = await admin.from('buffet_time_slots').insert(
      timeSlots.map((s) => ({
        id: slotMap.get(s.id),
        restaurant_id: targetId,
        name: s.name,
        start_time: s.start_time,
        end_time: s.end_time,
        weekdays: s.weekdays,
        sort_order: s.sort_order,
      })),
    );
    if (error) throw new Error(`buffet_time_slots: ${error.message}`);
    console.log(`Inserted ${timeSlots.length} time slots`);
  }
  if (calendarOverrides.length) {
    const { error } = await admin.from('buffet_calendar_overrides').insert(
      calendarOverrides.map((o) => ({
        restaurant_id: targetId,
        on_date: o.on_date,
        kind: o.kind,
      })),
    );
    if (error) throw new Error(`buffet_calendar_overrides: ${error.message}`);
    console.log(`Inserted ${calendarOverrides.length} calendar overrides`);
  }
  if (priceRules.length) {
    const { error } = await admin.from('buffet_price_rules').insert(
      priceRules.map((r) => ({
        id: randomUUID(),
        restaurant_id: targetId,
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
      })),
    );
    if (error) throw new Error(`buffet_price_rules: ${error.message}`);
    console.log(`Inserted ${priceRules.length} price rules`);
  }

  // --- menu ---
  const catMap = new Map(categories.map((c) => [c.id, randomUUID()]));
  const itemMap = new Map(items.map((i) => [i.id, randomUUID()]));

  if (categories.length) {
    const { error } = await admin.from('menu_categories').insert(
      categories.map((c) => ({
        id: catMap.get(c.id),
        restaurant_id: targetId,
        parent_id: c.parent_id ? catMap.get(c.parent_id) ?? null : null,
        name_pt: c.name_pt,
        name_en: c.name_en,
        name_zh: c.name_zh,
        sort_order: c.sort_order,
        active: c.active,
        print_station_id: c.print_station_id ? stationMap.get(c.print_station_id) ?? null : null,
        item_code: c.item_code,
      })),
    );
    if (error) throw new Error(`menu_categories: ${error.message}`);
    console.log(`Inserted ${categories.length} categories`);
  }

  if (items.length) {
    const newItems = items.map((i) => ({
      id: itemMap.get(i.id),
      restaurant_id: targetId,
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
      print_station_id: i.print_station_id ? stationMap.get(i.print_station_id) ?? null : null,
      item_code: i.item_code,
      per_person_qty_limit: i.per_person_qty_limit ?? null,
      over_limit_unit_price: i.over_limit_unit_price ?? null,
    }));
    for (let i = 0; i < newItems.length; i += 80) {
      const chunk = newItems.slice(i, i + 80);
      const { error } = await admin.from('menu_items').insert(chunk);
      if (error) throw new Error(`menu_items insert: ${error.message}`);
    }
    console.log(`Inserted ${newItems.length} menu items`);
  }

  const imagesDir = join(packDir, 'images');
  let imagesOk = 0;
  let imagesFail = 0;
  if (existsSync(imagesDir)) {
    const files = readdirSync(imagesDir);
    for (const file of files) {
      const m = file.match(/^([0-9a-f-]{36})\.([^.]+)$/i);
      if (!m) continue;
      const oldId = m[1];
      const ext = m[2];
      const newId = itemMap.get(oldId);
      if (!newId) {
        imagesFail += 1;
        continue;
      }
      const dstPath = `${targetId}/${newId}.${ext}`;
      const body = readFileSync(join(imagesDir, file));
      const { error: upErr } = await admin.storage.from(BUCKET).upload(dstPath, body, {
        contentType: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg',
        upsert: true,
      });
      if (upErr) {
        console.warn(`upload ${file}: ${upErr.message}`);
        imagesFail += 1;
        continue;
      }
      const url = menuImagePublicRefForEnv(env, dstPath);
      const { error: updErr } = await admin
        .from('menu_items')
        .update({ image_url: url })
        .eq('id', newId);
      if (updErr) {
        console.warn(`image_url update ${newId}: ${updErr.message}`);
        imagesFail += 1;
        continue;
      }
      imagesOk += 1;
      if (imagesOk % 25 === 0) console.log(`  images ${imagesOk}…`);
    }
  }
  console.log(`Images uploaded: ${imagesOk}, failed: ${imagesFail}`);
  console.log('Done — catalog imported.');
}

async function main() {
  if (command === 'export') return exportCatalog();
  if (command === 'import') return importCatalog();
  console.error(`Usage:
  node scripts/restaurant-catalog-transfer.mjs export --env .env.local.dev --restaurant-id <uuid> --out dist/pirata-catalog
  node scripts/restaurant-catalog-transfer.mjs import --env <store.env> --target-id <uuid> --pack dist/pirata-catalog --replace-tables [--dry-run]
`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
