#!/usr/bin/env node
/**
 * Pull one restaurant's setup config from cloud → local Docker (same UUIDs).
 * Scope = clear-business-data "keep" set (wide). Does NOT wipe other local restaurants.
 * Does NOT run supabase db reset.
 *
 * Usage:
 *   node scripts/pull-restaurant-setup-to-local.mjs \
 *     --restaurant-id 43e5feb1-2c23-4f59-90b0-da78b8a9c7e6 \
 *     --cloud-env .env.local \
 *     --local-env .env.local.dev \
 *     [--dry-run] [--skip-storage] [--skip-auth]
 */
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Inline local public ref (same contract as @mesa/shared toMenuImagePublicRef for HTTP local). */
function toLocalMenuImagePublicRef(objectPath, publishedOrigin) {
  const clean = String(objectPath || '').replace(/^\/+/, '');
  const origin = String(publishedOrigin || '').replace(/\/$/, '');
  if (!origin || /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)(:|\/|$)/i.test(origin)) {
    return `/storage/v1/object/public/${BUCKET}/${clean}`;
  }
  return `${origin}/storage/v1/object/public/${BUCKET}/${clean}`;
}

const BUCKET = 'menu-images';
const LOCAL_DB_URL = 'postgresql://postgres:postgres@host.docker.internal:54322/postgres';
const SYNC_DIR = resolve(process.cwd(), '.sync-tmp/restaurant-setup-pull');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipStorage = args.includes('--skip-storage');
const skipAuth = args.includes('--skip-auth');

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
      `Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in ${path}`,
    );
  }
  return env;
}

function adminClient(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function must(label, result) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function selectAll(admin, table, restaurantId, { order } = {}) {
  let q = admin.from(table).select('*').eq('restaurant_id', restaurantId);
  if (order) {
    for (const o of order) q = q.order(o.col, { ascending: o.asc !== false });
  }
  const { data, error } = await q;
  if (error) {
    if (/does not exist|Could not find the table/i.test(error.message)) {
      console.warn(`  skip missing table ${table}: ${error.message}`);
      return null;
    }
    throw new Error(`${table}: ${error.message}`);
  }
  return data ?? [];
}

async function localColumnMeta(_admin, table) {
  const sql = `
    select column_name, data_type, udt_name
    from information_schema.columns
    where table_schema = 'public' and table_name = '${table.replace(/'/g, "''")}'
    order by ordinal_position`;
  const out = runLocalSqlJson(sql);
  const map = new Map();
  for (const r of out || []) {
    map.set(r.column_name, r);
  }
  return map;
}

/** Parents before children for self-FK menu_categories. */
function orderCategories(categories) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const ordered = [];
  const seen = new Set();
  function visit(c) {
    if (!c || seen.has(c.id)) return;
    if (c.parent_id && byId.has(c.parent_id)) visit(byId.get(c.parent_id));
    seen.add(c.id);
    ordered.push(c);
  }
  for (const c of categories) visit(c);
  return ordered;
}

function runLocalSql(sql, { file } = {}) {
  mkdirSync(SYNC_DIR, { recursive: true });
  const sqlPath = file || join(SYNC_DIR, `stmt-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
  if (!file) writeFileSync(sqlPath, sql);
  const r = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '-v',
      `${SYNC_DIR}:/sync:ro`,
      'postgres:17',
      'psql',
      LOCAL_DB_URL,
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      `/sync/${sqlPath.split('/').pop()}`,
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    throw new Error(`local psql failed:\n${r.stdout || ''}\n${r.stderr || ''}`);
  }
  return r.stdout;
}

function runLocalSqlJson(sql) {
  mkdirSync(SYNC_DIR, { recursive: true });
  const name = `q-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`;
  const sqlPath = join(SYNC_DIR, name);
  writeFileSync(
    sqlPath,
    `COPY (
${sql}
) TO STDOUT WITH (FORMAT csv, HEADER true);`,
  );
  // Simpler: use psql -Atc with json_agg
  const name2 = `qj-${Date.now()}.sql`;
  const sqlPath2 = join(SYNC_DIR, name2);
  writeFileSync(
    sqlPath2,
    `select coalesce(json_agg(row_to_json(t)), '[]'::json) from (${sql}) t;`,
  );
  const r = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '-v',
      `${SYNC_DIR}:/sync:ro`,
      'postgres:17',
      'psql',
      LOCAL_DB_URL,
      '-v',
      'ON_ERROR_STOP=1',
      '-t',
      '-A',
      '-f',
      `/sync/${name2}`,
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    throw new Error(`local sql json failed:\n${r.stderr || r.stdout || ''}`);
  }
  const text = (r.stdout || '').trim();
  if (!text) return [];
  return JSON.parse(text);
}

function sqlLiteral(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'object') {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

function pickRow(row, columnMeta) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (columnMeta.has(k)) out[k] = v;
  }
  return out;
}

function sqlValue(v, meta) {
  const udt = meta?.udt_name || '';
  const dataType = meta?.data_type || '';
  if (udt === 'jsonb' || udt === 'json' || dataType === 'jsonb' || dataType === 'json') {
    return sqlLiteral(v == null ? null : v);
  }
  if (Array.isArray(v)) {
    if (v.length === 0) {
      if (udt.startsWith('_')) return `'{}'::${udt}`;
      return `'{}'`;
    }
    if (typeof v[0] === 'object') return sqlLiteral(v);
    const cast = udt.startsWith('_') ? udt : null;
    const body = `ARRAY[${v.map((x) => sqlLiteral(x)).join(',')}]`;
    return cast ? `${body}::${cast}` : body;
  }
  return sqlLiteral(v);
}

function insertSql(table, rows, columnMeta) {
  if (!rows.length) return '';
  const cols = [...columnMeta.keys()].filter((c) =>
    rows.some((r) => Object.prototype.hasOwnProperty.call(r, c)),
  );
  if (!cols.length) return '';
  const values = rows.map((r) => {
    const cells = cols.map((c) => sqlValue(r[c], columnMeta.get(c)));
    return `(${cells.join(', ')})`;
  });
  const colList = cols.map((c) => `"${c}"`).join(', ');
  const updates = cols
    .filter((c) => c !== 'id')
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');
  const conflict =
    table === 'buffet_calendar_overrides'
      ? '(restaurant_id, on_date)'
      : table === 'restaurant_pro_feature_grants'
        ? '(restaurant_id, feature_key)'
        : table === 'restaurant_table_group_members'
          ? '(group_id, table_id)'
          : table === 'kitchen_screen_stations'
            ? '(screen_id, print_station_id)'
            : table === 'menu_catalog_signals'
              ? '(restaurant_id)'
              : '(id)';
  if (table === 'buffet_calendar_overrides' || table === 'restaurant_pro_feature_grants') {
    return `INSERT INTO public."${table}" (${colList}) VALUES\n${values.join(',\n')}\nON CONFLICT ${conflict} DO UPDATE SET ${updates};\n`;
  }
  if (table === 'restaurant_table_group_members' || table === 'kitchen_screen_stations') {
    return `INSERT INTO public."${table}" (${colList}) VALUES\n${values.join(',\n')}\nON CONFLICT ${conflict} DO NOTHING;\n`;
  }
  return `INSERT INTO public."${table}" (${colList}) VALUES\n${values.join(',\n')}\nON CONFLICT ${conflict} DO UPDATE SET ${updates};\n`;
}

function storagePathFromUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx !== -1) return decodeURIComponent(imageUrl.slice(idx + marker.length));
  // root-relative
  const rel = `/storage/v1/object/public/${BUCKET}/`;
  if (imageUrl.startsWith(rel)) return decodeURIComponent(imageUrl.slice(rel.length));
  if (imageUrl.startsWith(`${BUCKET}/`)) return imageUrl.slice(BUCKET.length + 1);
  return null;
}

function rewritePublicUrl(url, localEnv) {
  if (!url || typeof url !== 'string') return url;
  const path = storagePathFromUrl(url);
  if (!path) return url;
  return toLocalMenuImagePublicRef(
    path,
    (localEnv.SUPABASE_PUBLIC_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  );
}

function cloudAuthDump(restaurantId) {
  mkdirSync(SYNC_DIR, { recursive: true });
  const usersSql = `
select coalesce(json_agg(row_to_json(u) order by u.email), '[]'::json) as users
from (
  select id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, reauthentication_token,
    phone, phone_change, phone_change_token,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    is_sso_user, is_anonymous, invited_at, confirmation_sent_at, recovery_sent_at,
    email_change_sent_at, last_sign_in_at, phone_confirmed_at, phone_change_sent_at,
    banned_until, deleted_at, is_super_admin, email_change_confirm_status,
    reauthentication_sent_at
  from auth.users
  where id in (
    select owner_id from public.restaurants where id = '${restaurantId}'
    union
    select user_id from public.restaurant_staff_accounts where restaurant_id = '${restaurantId}'
  )
) u;
`;
  const idSql = `
select coalesce(json_agg(row_to_json(i) order by i.user_id), '[]'::json) as identities
from (
  select id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, email
  from auth.identities
  where user_id in (
    select owner_id from public.restaurants where id = '${restaurantId}'
    union
    select user_id from public.restaurant_staff_accounts where restaurant_id = '${restaurantId}'
  )
) i;
`;
  const usersFile = join(SYNC_DIR, 'auth-users.json');
  const idFile = join(SYNC_DIR, 'auth-identities.json');
  for (const [sql, outPath, key] of [
    [usersSql, usersFile, 'users'],
    [idSql, idFile, 'identities'],
  ]) {
    const sqlFile = join(SYNC_DIR, `cloud-${key}.sql`);
    writeFileSync(sqlFile, sql);
    const r = spawnSync(
      'npx',
      ['supabase', 'db', 'query', '--linked', '--read-only', '-o', 'json', '-f', sqlFile],
      { encoding: 'utf8', cwd: process.cwd(), maxBuffer: 20 * 1024 * 1024 },
    );
    if (r.status !== 0) {
      throw new Error(`cloud auth dump (${key}) failed:\n${r.stderr || r.stdout || ''}`);
    }
    const parsed = JSON.parse(r.stdout);
    const rows = parsed.rows || parsed;
    const payload = Array.isArray(rows) ? rows[0]?.[key] ?? rows[0]?.users ?? rows[0]?.identities ?? [] : [];
    writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log(`  auth ${key}: ${Array.isArray(payload) ? payload.length : 0}`);
  }
  return {
    users: JSON.parse(readFileSync(usersFile, 'utf8')),
    identities: JSON.parse(readFileSync(idFile, 'utf8')),
  };
}

function emptyToNull(v) {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

function authUpsertSql(users, identities) {
  const lines = ['BEGIN;'];
  for (const u of users) {
    lines.push(`DELETE FROM auth.identities WHERE user_id = ${sqlLiteral(u.id)};`);
    lines.push(`DELETE FROM auth.users WHERE id = ${sqlLiteral(u.id)};`);
  }
  for (const u of users) {
    lines.push(`INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, reauthentication_token,
      phone, phone_change, phone_change_token,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      is_sso_user, is_anonymous, invited_at, confirmation_sent_at, recovery_sent_at,
      email_change_sent_at, last_sign_in_at, phone_confirmed_at, phone_change_sent_at,
      banned_until, deleted_at, is_super_admin, email_change_confirm_status,
      reauthentication_sent_at
    ) VALUES (
      ${sqlLiteral(u.id)},
      ${sqlLiteral(u.instance_id || '00000000-0000-0000-0000-000000000000')},
      ${sqlLiteral(u.aud || 'authenticated')},
      ${sqlLiteral(u.role || 'authenticated')},
      ${sqlLiteral(u.email)},
      ${sqlLiteral(u.encrypted_password)},
      ${sqlLiteral(u.email_confirmed_at)},
      ${sqlLiteral(u.confirmation_token ?? '')},
      ${sqlLiteral(u.recovery_token ?? '')},
      ${sqlLiteral(u.email_change ?? '')},
      ${sqlLiteral(u.email_change_token_new ?? '')},
      ${sqlLiteral(u.email_change_token_current ?? '')},
      ${sqlLiteral(u.reauthentication_token ?? '')},
      ${sqlLiteral(emptyToNull(u.phone))},
      ${sqlLiteral(u.phone_change ?? '')},
      ${sqlLiteral(u.phone_change_token ?? '')},
      ${sqlLiteral(u.raw_app_meta_data || { provider: 'email', providers: ['email'] })},
      ${sqlLiteral(u.raw_user_meta_data || {})},
      ${sqlLiteral(u.created_at)},
      ${sqlLiteral(u.updated_at)},
      ${sqlLiteral(!!u.is_sso_user)},
      ${sqlLiteral(!!u.is_anonymous)},
      ${sqlLiteral(u.invited_at)},
      ${sqlLiteral(u.confirmation_sent_at)},
      ${sqlLiteral(u.recovery_sent_at)},
      ${sqlLiteral(u.email_change_sent_at)},
      ${sqlLiteral(u.last_sign_in_at)},
      ${sqlLiteral(u.phone_confirmed_at)},
      ${sqlLiteral(u.phone_change_sent_at)},
      ${sqlLiteral(u.banned_until)},
      ${sqlLiteral(u.deleted_at)},
      ${sqlLiteral(u.is_super_admin)},
      ${sqlLiteral(u.email_change_confirm_status ?? 0)},
      ${sqlLiteral(u.reauthentication_sent_at)}
    );`);
  }
  for (const i of identities) {
    // auth.identities.email is generated — do not insert
    lines.push(`INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      ${sqlLiteral(i.id)},
      ${sqlLiteral(i.provider_id)},
      ${sqlLiteral(i.user_id)},
      ${sqlLiteral(i.identity_data || {})},
      ${sqlLiteral(i.provider)},
      ${sqlLiteral(i.last_sign_in_at)},
      ${sqlLiteral(i.created_at)},
      ${sqlLiteral(i.updated_at)}
    );`);
  }
  lines.push('COMMIT;');
  return `${lines.join('\n')}\n`;
}

function wipeRestaurantSetupSql(restaurantId) {
  const id = sqlLiteral(restaurantId);
  return `
BEGIN;
-- ops first (FK safety) — only this restaurant
DELETE FROM public.cash_drawer_jobs WHERE restaurant_id = ${id};
DELETE FROM public.print_jobs WHERE restaurant_id = ${id};
DELETE FROM public.bill_sync_jobs WHERE restaurant_id = ${id};
DELETE FROM public.fiscal_clear_jobs WHERE restaurant_id = ${id};
DELETE FROM public.abnormal_operations WHERE restaurant_id = ${id};
DELETE FROM public.operation_logs WHERE restaurant_id = ${id};
DELETE FROM public.analytics_daily_restaurant_stats WHERE restaurant_id = ${id};
DELETE FROM public.analytics_daily_menu_item_stats WHERE restaurant_id = ${id};
DELETE FROM public.analytics_daily_menu_item_consumption WHERE restaurant_id = ${id};
DELETE FROM public.dish_feedback WHERE restaurant_id = ${id};
DELETE FROM public.feedback_sessions WHERE restaurant_id = ${id};
DELETE FROM public.bill_split_ticket_calls WHERE restaurant_id = ${id};
DELETE FROM public.table_checkout_signals WHERE restaurant_id = ${id};
DELETE FROM public.session_collected_payments WHERE restaurant_id = ${id};
DELETE FROM public.order_append_idempotency WHERE restaurant_id = ${id};
DELETE FROM public.table_order_round_lines WHERE round_id IN (SELECT id FROM public.table_order_rounds WHERE restaurant_id = ${id});
DELETE FROM public.table_order_round_clients WHERE restaurant_id = ${id};
DELETE FROM public.table_order_rounds WHERE restaurant_id = ${id};
DELETE FROM public.table_session_events WHERE restaurant_id = ${id};
UPDATE public.table_sessions SET merge_into_session_id = NULL WHERE restaurant_id = ${id} AND merge_into_session_id IS NOT NULL;
DELETE FROM public.bill_splits WHERE restaurant_id = ${id};
DELETE FROM public.orders WHERE restaurant_id = ${id};
DELETE FROM public.table_sessions WHERE restaurant_id = ${id};
DELETE FROM public.table_party_group_members WHERE restaurant_id = ${id};
DELETE FROM public.table_party_groups WHERE restaurant_id = ${id};

-- setup children
DELETE FROM public.kitchen_screen_stations WHERE screen_id IN (SELECT id FROM public.kitchen_screens WHERE restaurant_id = ${id});
DELETE FROM public.kitchen_screens WHERE restaurant_id = ${id};
DELETE FROM public.print_agent_support_tokens WHERE restaurant_id = ${id};
DELETE FROM public.print_agent_devices WHERE restaurant_id = ${id};
DELETE FROM public.print_agent_pairings WHERE restaurant_id = ${id};
DELETE FROM public.menu_recommended_items WHERE restaurant_id = ${id};
DELETE FROM public.menu_item_buffet_prices WHERE restaurant_id = ${id}; -- no-op if empty
DELETE FROM public.menu_items WHERE restaurant_id = ${id};
DELETE FROM public.menu_categories WHERE restaurant_id = ${id};
DELETE FROM public.menu_note_presets WHERE restaurant_id = ${id};
DELETE FROM public.menu_note_preset_groups WHERE restaurant_id = ${id};
DELETE FROM public.menu_choice_options WHERE restaurant_id = ${id};
DELETE FROM public.menu_choice_groups WHERE restaurant_id = ${id};
DELETE FROM public.buffet_price_rules WHERE restaurant_id = ${id};
DELETE FROM public.buffet_calendar_overrides WHERE restaurant_id = ${id};
DELETE FROM public.buffet_time_slots WHERE restaurant_id = ${id};
DELETE FROM public.buffets WHERE restaurant_id = ${id};
DELETE FROM public.restaurant_table_group_members WHERE restaurant_id = ${id};
DELETE FROM public.restaurant_table_groups WHERE restaurant_id = ${id};
DELETE FROM public.restaurant_tables WHERE restaurant_id = ${id};
DELETE FROM public.restaurant_staff_accounts WHERE restaurant_id = ${id};
DELETE FROM public.restaurant_roles WHERE restaurant_id = ${id};
DELETE FROM public.restaurant_pro_feature_grants WHERE restaurant_id = ${id};
DELETE FROM public.restaurant_installations WHERE restaurant_id = ${id};
DELETE FROM public.fiscal_signing_installations WHERE restaurant_id = ${id};
DELETE FROM public.print_stations WHERE restaurant_id = ${id};
DELETE FROM public.menu_catalog_signals WHERE restaurant_id = ${id};
DELETE FROM public.restaurants WHERE id = ${id};
COMMIT;
`;
}

async function fetchPack(cloud, restaurantId) {
  const restaurant = await must(
    'restaurant',
    await cloud.from('restaurants').select('*').eq('id', restaurantId).single(),
  );

  const [
    roles,
    staff,
    grants,
    installations,
    fiscal,
    stations,
    pairings,
    devices,
    screens,
    buffets,
    slots,
    cal,
    rules,
    noteGroups,
    notes,
    choiceGroups,
    choiceOptions,
    categories,
    items,
    buffetPrices,
    recommended,
    tables,
    groups,
    members,
  ] = await Promise.all([
    selectAll(cloud, 'restaurant_roles', restaurantId, { order: [{ col: 'sort_order' }] }),
    selectAll(cloud, 'restaurant_staff_accounts', restaurantId),
    selectAll(cloud, 'restaurant_pro_feature_grants', restaurantId),
    selectAll(cloud, 'restaurant_installations', restaurantId),
    selectAll(cloud, 'fiscal_signing_installations', restaurantId),
    selectAll(cloud, 'print_stations', restaurantId, { order: [{ col: 'sort_order' }] }),
    selectAll(cloud, 'print_agent_pairings', restaurantId),
    selectAll(cloud, 'print_agent_devices', restaurantId),
    selectAll(cloud, 'kitchen_screens', restaurantId, { order: [{ col: 'sort_order' }] }),
    selectAll(cloud, 'buffets', restaurantId),
    selectAll(cloud, 'buffet_time_slots', restaurantId, { order: [{ col: 'sort_order' }] }),
    selectAll(cloud, 'buffet_calendar_overrides', restaurantId),
    selectAll(cloud, 'buffet_price_rules', restaurantId),
    selectAll(cloud, 'menu_note_preset_groups', restaurantId, { order: [{ col: 'sort_order' }] }),
    selectAll(cloud, 'menu_note_presets', restaurantId, { order: [{ col: 'sort_order' }] }),
    selectAll(cloud, 'menu_choice_groups', restaurantId, { order: [{ col: 'sort_order' }] }),
    selectAll(cloud, 'menu_choice_options', restaurantId, { order: [{ col: 'sort_order' }] }),
    selectAll(cloud, 'menu_categories', restaurantId, { order: [{ col: 'sort_order' }] }),
    selectAll(cloud, 'menu_items', restaurantId, {
      order: [{ col: 'sort_order' }, { col: 'created_at' }],
    }),
    selectAll(cloud, 'menu_item_buffet_prices', restaurantId),
    selectAll(cloud, 'menu_recommended_items', restaurantId, { order: [{ col: 'sort_order' }] }),
    selectAll(cloud, 'restaurant_tables', restaurantId, { order: [{ col: 'sort_order' }] }),
    selectAll(cloud, 'restaurant_table_groups', restaurantId, { order: [{ col: 'sort_order' }] }),
    selectAll(cloud, 'restaurant_table_group_members', restaurantId),
  ]);

  let screenStations = [];
  if (screens?.length) {
    const ids = screens.map((s) => s.id);
    const { data, error } = await cloud.from('kitchen_screen_stations').select('*').in('screen_id', ids);
    if (error) throw new Error(`kitchen_screen_stations: ${error.message}`);
    screenStations = data ?? [];
  }

  const counts = {
    restaurant: 1,
    restaurant_roles: roles?.length ?? 0,
    restaurant_staff_accounts: staff?.length ?? 0,
    restaurant_pro_feature_grants: grants?.length ?? 0,
    restaurant_installations: installations?.length ?? 0,
    fiscal_signing_installations: fiscal?.length ?? 0,
    print_stations: stations?.length ?? 0,
    print_agent_pairings: pairings?.length ?? 0,
    print_agent_devices: devices?.length ?? 0,
    kitchen_screens: screens?.length ?? 0,
    kitchen_screen_stations: screenStations.length,
    buffets: buffets?.length ?? 0,
    buffet_time_slots: slots?.length ?? 0,
    buffet_calendar_overrides: cal?.length ?? 0,
    buffet_price_rules: rules?.length ?? 0,
    menu_note_preset_groups: noteGroups?.length ?? 0,
    menu_note_presets: notes?.length ?? 0,
    menu_choice_groups: choiceGroups?.length ?? 0,
    menu_choice_options: choiceOptions?.length ?? 0,
    menu_categories: categories?.length ?? 0,
    menu_items: items?.length ?? 0,
    menu_item_buffet_prices: buffetPrices?.length ?? 0,
    menu_recommended_items: recommended?.length ?? 0,
    restaurant_tables: tables?.length ?? 0,
    restaurant_table_groups: groups?.length ?? 0,
    restaurant_table_group_members: members?.length ?? 0,
  };

  return {
    restaurant,
    roles: roles || [],
    staff: staff || [],
    grants: grants || [],
    installations: installations || [],
    fiscal: fiscal || [],
    stations: stations || [],
    pairings: pairings || [],
    devices: devices || [],
    screens: screens || [],
    screenStations,
    buffets: buffets || [],
    slots: slots || [],
    cal: cal || [],
    rules: rules || [],
    noteGroups: noteGroups || [],
    notes: notes || [],
    choiceGroups: choiceGroups || [],
    choiceOptions: choiceOptions || [],
    categories: categories || [],
    items: items || [],
    buffetPrices: buffetPrices || [],
    recommended: recommended || [],
    tables: tables || [],
    groups: groups || [],
    members: members || [],
    counts,
  };
}

async function checkConflicts(local, pack) {
  const conflicts = [];
  const { data: slugHit } = await local
    .from('restaurants')
    .select('id, name, slug')
    .eq('slug', pack.restaurant.slug)
    .neq('id', pack.restaurant.id)
    .maybeSingle();
  if (slugHit) {
    conflicts.push(`slug "${pack.restaurant.slug}" owned by other restaurant ${slugHit.id} (${slugHit.name})`);
  }

  const loginNames = pack.staff.map((s) => s.login_name).filter(Boolean);
  if (loginNames.length) {
    const { data: loginHits } = await local
      .from('restaurant_staff_accounts')
      .select('login_name, restaurant_id, user_id')
      .in('login_name', loginNames);
    for (const hit of loginHits || []) {
      if (hit.restaurant_id !== pack.restaurant.id) {
        conflicts.push(
          `login_name "${hit.login_name}" used by restaurant ${hit.restaurant_id}`,
        );
      }
    }
  }

  const emails = [
    pack.restaurant.owner_email,
    ...pack.staff.map((s) => s.login_name), // auth emails checked via SQL below for owner
  ].filter(Boolean);

  if (pack.restaurant.owner_email) {
    const emailHits = runLocalSqlJson(`
      select id, email from auth.users
      where lower(email) = lower(${sqlLiteral(pack.restaurant.owner_email)})
        and id <> ${sqlLiteral(pack.restaurant.owner_id)}
    `);
    for (const hit of emailHits) {
      conflicts.push(`auth email "${hit.email}" owned by other user ${hit.id}`);
    }
  }

  void emails;
  return conflicts;
}

async function copyStorage(cloud, local, localEnv, pack) {
  const paths = new Set();
  for (const item of pack.items) {
    for (const key of ['image_url', 'video_url', 'rail_video_url']) {
      const p = storagePathFromUrl(item[key]);
      if (p) paths.add(p);
    }
  }
  for (const key of ['logo_url', 'cover_url']) {
    const p = storagePathFromUrl(pack.restaurant[key]);
    if (p) paths.add(p);
  }

  // Also list storefront prefix if present
  const prefix = `${pack.restaurant.id}/`;
  const { data: storefront } = await cloud.storage
    .from(BUCKET)
    .list(`${pack.restaurant.id}/storefront`, { limit: 100 });
  for (const obj of storefront || []) {
    // folders have id null / metadata null in storage list
    if (obj?.name && obj.metadata) {
      paths.add(`${pack.restaurant.id}/storefront/${obj.name}`);
    }
  }
  void prefix;

  let ok = 0;
  let fail = 0;
  for (const path of paths) {
    const { data, error } = await cloud.storage.from(BUCKET).download(path);
    if (error || !data) {
      console.warn(`  storage download fail ${path}: ${error?.message || 'empty'}`);
      fail += 1;
      continue;
    }
    const buf = Buffer.from(await data.arrayBuffer());
    const ext = path.split('.').pop()?.toLowerCase() || 'bin';
    const contentType =
      ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'mp4'
            ? 'video/mp4'
            : ext === 'gif'
              ? 'image/gif'
              : 'image/jpeg';
    const { error: upErr } = await local.storage.from(BUCKET).upload(path, buf, {
      contentType,
      upsert: true,
    });
    if (upErr) {
      console.warn(`  storage upload fail ${path}: ${upErr.message}`);
      fail += 1;
      continue;
    }
    ok += 1;
    if (ok % 25 === 0) console.log(`  storage ${ok}…`);
  }
  console.log(`Storage copied: ok=${ok} fail=${fail} (unique paths=${paths.size})`);
  return { ok, fail, paths: [...paths] };
}

function rewritePackUrls(pack, localEnv) {
  pack.restaurant.logo_url = rewritePublicUrl(pack.restaurant.logo_url, localEnv);
  pack.restaurant.cover_url = rewritePublicUrl(pack.restaurant.cover_url, localEnv);
  for (const item of pack.items) {
    item.image_url = rewritePublicUrl(item.image_url, localEnv);
    if (item.video_url) item.video_url = rewritePublicUrl(item.video_url, localEnv);
    if (item.rail_video_url) item.rail_video_url = rewritePublicUrl(item.rail_video_url, localEnv);
  }
}

async function buildInsertSql(local, pack) {
  const tables = [
    ['restaurants', [pack.restaurant]],
    ['restaurant_pro_feature_grants', pack.grants],
    ['restaurant_installations', pack.installations],
    ['fiscal_signing_installations', pack.fiscal],
    ['restaurant_roles', pack.roles],
    ['print_stations', pack.stations],
    ['print_agent_pairings', pack.pairings],
    ['print_agent_devices', pack.devices],
    ['kitchen_screens', pack.screens],
    ['kitchen_screen_stations', pack.screenStations],
    ['buffets', pack.buffets],
    ['buffet_time_slots', pack.slots],
    ['buffet_calendar_overrides', pack.cal],
    ['buffet_price_rules', pack.rules],
    ['menu_note_preset_groups', pack.noteGroups],
    ['menu_note_presets', pack.notes],
    ['menu_choice_groups', pack.choiceGroups],
    ['menu_choice_options', pack.choiceOptions],
    ['menu_categories', orderCategories(pack.categories)],
    ['menu_items', pack.items],
    ['menu_item_buffet_prices', pack.buffetPrices],
    ['menu_recommended_items', pack.recommended],
    ['restaurant_tables', pack.tables],
    ['restaurant_table_groups', pack.groups],
    ['restaurant_table_group_members', pack.members],
    ['restaurant_staff_accounts', pack.staff],
  ];

  const parts = ['BEGIN;'];
  const ridLit = sqlLiteral(pack.restaurant.id);
  for (const [table, rows] of tables) {
    if (!rows.length && table !== 'restaurants') continue;
    if (table === 'restaurants') {
      const meta = await localColumnMeta(local, table);
      const picked = rows.map((r) => pickRow(r, meta));
      parts.push(insertSql(table, picked, meta));
      // New restaurant row fires seed_default_* triggers — clear those before packing real rows.
      parts.push(`DELETE FROM public.restaurant_table_group_members WHERE restaurant_id = ${ridLit};`);
      parts.push(`DELETE FROM public.restaurant_table_groups WHERE restaurant_id = ${ridLit};`);
      parts.push(`DELETE FROM public.restaurant_tables WHERE restaurant_id = ${ridLit};`);
      parts.push(`DELETE FROM public.print_stations WHERE restaurant_id = ${ridLit};`);
      console.log(`  will upsert ${table}: ${picked.length} (+ clear seed tables/stations)`);
      continue;
    }
    if (!rows.length) continue;
    const meta = await localColumnMeta(local, table);
    if (!meta.size) {
      console.warn(`  local missing table ${table}, skip ${rows.length} rows`);
      continue;
    }
    const picked = rows.map((r) => pickRow(r, meta));
    parts.push(insertSql(table, picked, meta));
    console.log(`  will upsert ${table}: ${picked.length}`);
  }

  // menu_catalog_signals
  const signalMeta = await localColumnMeta(local, 'menu_catalog_signals');
  if (signalMeta.size) {
    const version = pack.restaurant.menu_catalog_version ?? 0;
    parts.push(`INSERT INTO public.menu_catalog_signals (restaurant_id, version, bumped_at)
      VALUES (${sqlLiteral(pack.restaurant.id)}, ${sqlLiteral(version)}, NOW())
      ON CONFLICT (restaurant_id) DO UPDATE SET version = EXCLUDED.version, bumped_at = EXCLUDED.bumped_at;`);
  }

  parts.push('COMMIT;');
  return parts.join('\n');
}

async function main() {
  const restaurantId = flagValue('--restaurant-id');
  if (!restaurantId) throw new Error('--restaurant-id required');
  const cloudEnvPath = flagValue('--cloud-env') || '.env.local';
  const localEnvPath = flagValue('--local-env') || '.env.local.dev';
  const expectSlug = flagValue('--slug');

  const cloudEnv = loadEnv(cloudEnvPath);
  const localEnv = loadEnv(localEnvPath);
  const cloud = adminClient(cloudEnv);
  const local = adminClient(localEnv);

  mkdirSync(SYNC_DIR, { recursive: true });

  console.log(`Cloud: ${cloudEnv.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`Local: ${localEnv.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`Restaurant: ${restaurantId}${dryRun ? ' (dry-run)' : ''}`);

  const otherBefore = runLocalSqlJson(
    `select count(*)::int as n from public.restaurants where id <> '${restaurantId.replace(/'/g, "''")}'`,
  )[0]?.n;

  const pack = await fetchPack(cloud, restaurantId);
  console.log(`Source: ${pack.restaurant.name} / ${pack.restaurant.slug}`);
  if (expectSlug && pack.restaurant.slug !== expectSlug) {
    throw new Error(`slug mismatch: cloud=${pack.restaurant.slug} expected=${expectSlug}`);
  }
  console.log('Counts:', JSON.stringify(pack.counts, null, 2));

  const conflicts = await checkConflicts(local, pack);
  if (conflicts.length) {
    console.error('Conflicts:');
    for (const c of conflicts) console.error(`  - ${c}`);
    process.exit(1);
  }
  console.log('Conflict check: ok');

  let auth = { users: [], identities: [] };
  if (!skipAuth) {
    console.log('Dumping auth users/identities from cloud…');
    auth = cloudAuthDump(restaurantId);
  }

  if (dryRun) {
    console.log('Dry run — no writes.');
    console.log(`Other local restaurants (unchanged target): ${otherBefore}`);
    return;
  }

  // Snapshot other restaurant count
  writeFileSync(
    join(SYNC_DIR, 'other-restaurants-before.json'),
    JSON.stringify({ otherBefore }, null, 2),
  );

  if (!skipAuth && auth.users.length) {
    const authSqlPath = join(SYNC_DIR, 'auth-upsert.sql');
    writeFileSync(authSqlPath, authUpsertSql(auth.users, auth.identities));
    console.log('Upserting auth users…');
    runLocalSql('', { file: authSqlPath });
  }

  const wipePath = join(SYNC_DIR, 'wipe-setup.sql');
  writeFileSync(wipePath, wipeRestaurantSetupSql(restaurantId));
  console.log('Wiping local City Wok setup (if any)…');
  runLocalSql('', { file: wipePath });

  if (!skipStorage) {
    console.log('Copying menu-images / storefront…');
    await copyStorage(cloud, local, localEnv, pack);
  }

  rewritePackUrls(pack, localEnv);

  const insertPath = join(SYNC_DIR, 'insert-setup.sql');
  const insertSqlText = await buildInsertSql(local, pack);
  writeFileSync(insertPath, insertSqlText);
  console.log('Inserting setup rows…');
  runLocalSql('', { file: insertPath });

  const otherAfter = runLocalSqlJson(
    `select count(*)::int as n from public.restaurants where id <> '${restaurantId.replace(/'/g, "''")}'`,
  )[0]?.n;
  const localRest = runLocalSqlJson(
    `select id, name, slug from public.restaurants where id = '${restaurantId.replace(/'/g, "''")}'`,
  );
  const localMenu = runLocalSqlJson(
    `select count(*)::int as n from public.menu_items where restaurant_id = '${restaurantId.replace(/'/g, "''")}'`,
  )[0]?.n;
  const localTables = runLocalSqlJson(
    `select count(*)::int as n from public.restaurant_tables where restaurant_id = '${restaurantId.replace(/'/g, "''")}'`,
  )[0]?.n;

  console.log('Local restaurant:', localRest[0]);
  console.log(`Local menu_items=${localMenu} tables=${localTables}`);
  console.log(`Other restaurants before=${otherBefore} after=${otherAfter}`);
  if (otherBefore !== otherAfter) {
    throw new Error('Other restaurant count changed — abort investigation needed');
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
