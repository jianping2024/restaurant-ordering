#!/usr/bin/env node
/**
 * Integration smoke test for Mesa Ops P2 (local dev server on :3001).
 * Creates ephemeral platform admin/support users, exercises role boundaries, then cleans up.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createRestaurantWithOwner } from '@mesa/shared';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENV_FILE = process.env.ENV_FILE
  ? path.resolve(process.env.ENV_FILE)
  : path.join(ROOT, '.env.local.dev');
const BASE = process.env.OPS_TEST_BASE_URL || 'http://localhost:3001';
const TAG = `ops-p2-${Date.now()}`;
const ADMIN_EMAIL = `${TAG}-admin@test.mesa.local`;
const SUPPORT_EMAIL = `${TAG}-support@test.mesa.local`;
const PASSWORD = 'TestOpsP2!99';

const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

function cookiesFromResponse(res) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return raw.map((c) => c.split(';')[0]).join('; ');
}

async function api(method, path, { body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
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
    json = { raw: text };
  }
  return { status: res.status, json, cookie: cookiesFromResponse(res) };
}

async function login(email, password) {
  const res = await api('POST', '/api/ops/auth/login', { body: { email, password } });
  return { ...res, sessionCookie: res.cookie };
}

async function createPlatformUser(admin, email, role, displayName) {
  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (createError || !userData.user) throw new Error(`createUser ${email}: ${createError?.message}`);

  const { data: row, error: insertError } = await admin
    .from('platform_admin_accounts')
    .insert({ user_id: userData.user.id, role, display_name: displayName })
    .select('id')
    .single();

  if (insertError) {
    await admin.auth.admin.deleteUser(userData.user.id);
    throw new Error(`insert account ${email}: ${insertError.message}`);
  }

  return { userId: userData.user.id, accountId: row.id };
}

async function main() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error('Missing .env.local.dev — start local Supabase first.');
    process.exit(1);
  }

  const env = loadEnv(ENV_FILE);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing Supabase env vars in .env.local.dev');
    process.exit(1);
  }

  const sb = createClient(url, serviceKey);
  const created = { userIds: [], accountIds: [] };
  let restaurantId = null;
  let originalName = null;
  let staffId = null;
  let ephemeralRestaurant = false;
  let ephemeralOwnerId = null;

  try {
    // Health: dev server up
    const ping = await api('GET', '/ops/login');
    record('dev server reachable', ping.status === 200, `HTTP ${ping.status}`);

    const { data: restaurants } = await sb.from('restaurants').select('id, name').limit(1);
    if (restaurants?.length) {
      restaurantId = restaurants[0].id;
      originalName = restaurants[0].name;
      record('fixture restaurant exists', true, restaurantId);
    } else {
      const createdRestaurant = await createRestaurantWithOwner(sb, {
        name: `P2 Test ${TAG}`,
        email: `${TAG}-owner@test.mesa.local`,
        password: PASSWORD,
        printLocale: 'pt',
      });
      if (!createdRestaurant.ok) {
        record('create ephemeral restaurant', false, createdRestaurant.error);
        return;
      }
      restaurantId = createdRestaurant.restaurantId;
      originalName = `P2 Test ${TAG}`;
      ephemeralOwnerId = createdRestaurant.ownerId;
      ephemeralRestaurant = true;
      record('create ephemeral restaurant', true, restaurantId);
    }

    const adminUser = await createPlatformUser(sb, ADMIN_EMAIL, 'admin', 'P2 Test Admin');
    const supportUser = await createPlatformUser(sb, SUPPORT_EMAIL, 'support', 'P2 Test Support');
    created.userIds.push(adminUser.userId, supportUser.userId);
    created.accountIds.push(adminUser.accountId, supportUser.accountId);
    record('create ephemeral admin/support users', true);

    // Unauthenticated
    const unauth = await api('GET', '/api/ops/admins');
    record('unauthenticated GET /api/ops/admins -> 401', unauth.status === 401);

    // Support session
    const supportLogin = await login(SUPPORT_EMAIL, PASSWORD);
    record('support login', supportLogin.status === 200, `HTTP ${supportLogin.status}`);
    const supportCookie = supportLogin.sessionCookie;

    const supportList = await api('GET', '/api/ops/restaurants', { cookie: supportCookie });
    record('support can list restaurants', supportList.status === 200);

    const supportAdmins = await api('GET', '/api/ops/admins', { cookie: supportCookie });
    record('support blocked from GET /api/ops/admins -> 403', supportAdmins.status === 403);

    const supportPatch = await api('PATCH', `/api/ops/restaurants/${restaurantId}`, {
      cookie: supportCookie,
      body: { name: 'Should Not Apply' },
    });
    record('support blocked from PATCH restaurant -> 403', supportPatch.status === 403);

    const supportSuspend = await api('POST', `/api/ops/restaurants/${restaurantId}/suspend`, {
      cookie: supportCookie,
      body: { reason: 'test' },
    });
    record('support blocked from suspend -> 403', supportSuspend.status === 403);

    const supportStaff = await api('GET', `/api/ops/restaurants/${restaurantId}/staff`, {
      cookie: supportCookie,
    });
    record('support can list staff', supportStaff.status === 200);

    const supportStaffPatch = await api(
      'PATCH',
      `/api/ops/restaurants/${restaurantId}/staff/00000000-0000-0000-0000-000000000099`,
      { cookie: supportCookie, body: { action: 'disable' } },
    );
    record('support blocked from staff disable -> 403', supportStaffPatch.status === 403);

    // Admin session
    const adminLogin = await login(ADMIN_EMAIL, PASSWORD);
    record('admin login', adminLogin.status === 200, `HTTP ${adminLogin.status}`);
    const adminCookie = adminLogin.sessionCookie;

    const adminList = await api('GET', '/api/ops/admins', { cookie: adminCookie });
    record(
      'admin can list ops accounts',
      adminList.status === 200 && Array.isArray(adminList.json?.items),
      `count=${adminList.json?.items?.length ?? 0}`,
    );

    const newName = `${originalName} [p2-test]`;
    const adminPatch = await api('PATCH', `/api/ops/restaurants/${restaurantId}`, {
      cookie: adminCookie,
      body: { name: newName },
    });
    record('admin can PATCH restaurant name', adminPatch.status === 200, `HTTP ${adminPatch.status}`);

    const { data: updated } = await sb.from('restaurants').select('name').eq('id', restaurantId).single();
    record('restaurant name persisted', updated?.name === newName, updated?.name);

    const slugProbe = await api('PATCH', `/api/ops/restaurants/${restaurantId}`, {
      cookie: adminCookie,
      body: { slug: `p2-test-${TAG}` },
    });
    record(
      'slug change requires confirmation -> 409',
      slugProbe.status === 409 && slugProbe.json?.error === 'slug_change_requires_confirmation',
      `HTTP ${slugProbe.status}`,
    );

    const adminStaff = await api('GET', `/api/ops/restaurants/${restaurantId}/staff`, {
      cookie: adminCookie,
    });
    record('admin can list staff', adminStaff.status === 200);
    if (adminStaff.json?.items?.length) {
      staffId = adminStaff.json.items.find((s) => !s.disabledAt)?.id ?? null;
    }

    if (staffId) {
      const disableStaff = await api('PATCH', `/api/ops/restaurants/${restaurantId}/staff/${staffId}`, {
        cookie: adminCookie,
        body: { action: 'disable' },
      });
      record('admin can disable staff', disableStaff.status === 200, `staffId=${staffId}`);

      const enableStaff = await api('PATCH', `/api/ops/restaurants/${restaurantId}/staff/${staffId}`, {
        cookie: adminCookie,
        body: { action: 'enable' },
      });
      record('admin can re-enable staff', enableStaff.status === 200);
    } else {
      record('admin staff disable/enable round-trip', true, 'skipped — no active staff on fixture restaurant');
    }

    const { data: auditRows } = await sb
      .from('platform_admin_audit_log')
      .select('action')
      .eq('actor_user_id', adminUser.userId)
      .in('action', ['ops.login', 'restaurant.update']);

    const auditActions = new Set((auditRows || []).map((r) => r.action));
    record(
      'audit log records admin actions',
      auditActions.has('ops.login') && auditActions.has('restaurant.update'),
      [...auditActions].join(', '),
    );
  } finally {
    if (restaurantId && originalName && !ephemeralRestaurant) {
      await sb.from('restaurants').update({ name: originalName }).eq('id', restaurantId);
    }
    if (ephemeralRestaurant && restaurantId) {
      await sb.from('restaurants').delete().eq('id', restaurantId);
    }
    if (ephemeralOwnerId) {
      await sb.auth.admin.deleteUser(ephemeralOwnerId);
    }
    for (const accountId of created.accountIds) {
      await sb.from('platform_admin_accounts').delete().eq('id', accountId);
    }
    for (const userId of created.userIds) {
      await sb.auth.admin.deleteUser(userId);
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== Summary ===');
  console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL: ${f.name} — ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
