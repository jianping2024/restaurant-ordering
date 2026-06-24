#!/usr/bin/env node
/**
 * Extends P2 integration with audit list/export checks (refactored ops-audit-log).
 * Requires local ops on :3001 and .env.local.dev.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.local.dev');
const BASE = process.env.OPS_TEST_BASE_URL || 'http://localhost:3001';
const TAG = `ops-audit-${Date.now()}`;
const EMAIL = `${TAG}@test.mesa.local`;
const PASSWORD = 'TestOpsAudit!99';

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return env;
}

function cookiesFromResponse(res) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return raw.map((c) => c.split(';')[0]).join('; ');
}

async function api(method, urlPath, { body, cookie } = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text, headers: res.headers, cookie: cookiesFromResponse(res) };
}

async function main() {
  const env = loadEnv(ENV_FILE);
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: userErr } = await sb.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (userErr || !userData.user) throw new Error(userErr?.message || 'create user failed');

  const { data: account, error: accErr } = await sb
    .from('platform_admin_accounts')
    .insert({ user_id: userData.user.id, role: 'admin', display_name: 'Audit Test' })
    .select('id')
    .single();
  if (accErr) throw new Error(accErr.message);

  const { data: restaurant } = await sb.from('restaurants').select('id, name').limit(1).single();
  if (!restaurant) throw new Error('no restaurant fixture');

  await sb.from('platform_admin_audit_log').insert({
    actor_user_id: userData.user.id,
    action: 'restaurant.update',
    target_type: 'restaurant',
    target_id: restaurant.id,
    restaurant_id: restaurant.id,
    metadata: { field: 'name', testTag: TAG },
  });

  try {
    const login = await api('POST', '/api/ops/auth/login', { body: { email: EMAIL, password: PASSWORD } });
    record('admin login', login.status === 200, `HTTP ${login.status}`);
    const cookie = login.cookie;

    const unauth = await api('GET', '/api/ops/audit');
    record('unauthenticated audit -> 401', unauth.status === 401);

    const list = await api('GET', '/api/ops/audit?page=1', { cookie });
    const item = list.json?.items?.find((r) => r.metadata?.testTag === TAG);
    record('GET /api/ops/audit returns items', list.status === 200 && Array.isArray(list.json?.items));
    record(
      'audit item has actorEmail + restaurantName',
      Boolean(item?.actorEmail === EMAIL && item?.restaurantName === restaurant.name),
      item ? `${item.actorEmail} / ${item.restaurantName}` : 'row not found',
    );

    const filtered = await api(
      'GET',
      `/api/ops/audit?action=restaurant.update&restaurantId=${restaurant.id}`,
      { cookie },
    );
    record(
      'audit filters by action + restaurantId',
      filtered.status === 200 &&
        filtered.json?.items?.some((r) => r.metadata?.testTag === TAG),
    );

    const exportRes = await api('GET', '/api/ops/audit/export', { cookie });
    record('GET /api/ops/audit/export -> 200 csv', exportRes.status === 200);
    record(
      'export Content-Type is text/csv',
      (exportRes.headers.get('content-type') || '').includes('text/csv'),
    );
    record(
      'export includes restaurant name and email',
      exportRes.text.includes(restaurant.name) && exportRes.text.includes(EMAIL),
    );

    const admins = await api('GET', '/api/ops/admins', { cookie });
    const self = admins.json?.items?.find((r) => r.userId === userData.user.id);
    record(
      'GET /api/ops/admins resolves email (fetchUserEmailsMap)',
      admins.status === 200 && self?.email === EMAIL,
    );

    const restaurants = await api('GET', '/api/ops/restaurants', { cookie });
    record(
      'GET /api/ops/restaurants returns owner emails',
      restaurants.status === 200 &&
        Array.isArray(restaurants.json?.items) &&
        restaurants.json.items.some((r) => typeof r.ownerEmail === 'string' || r.ownerEmail === null),
    );
  } finally {
    await sb.from('platform_admin_audit_log').delete().contains('metadata', { testTag: TAG });
    await sb.from('platform_admin_accounts').delete().eq('id', account.id);
    await sb.auth.admin.deleteUser(userData.user.id);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== Summary ===\nTotal: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
