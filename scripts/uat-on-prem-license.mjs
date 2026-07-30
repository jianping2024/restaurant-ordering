#!/usr/bin/env node
/**
 * Local UAT: on-prem license control plane (register → issue → claim → extend →
 * suspend/resume → check-in → materialize). Also cloud suspend via licenses API.
 * Requires ops on :3001 with MESA_LICENSE_LEASE_SECRET.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  decideLicenseMaterialize,
  isRestaurantSuspended,
  LICENSE_OFFLINE_GRACE_MS,
  SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED,
} from '@mesa/shared';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENV_FILE = process.env.ENV_FILE
  ? path.resolve(process.env.ENV_FILE)
  : path.join(ROOT, '.env.local.dev');
const BASE = process.env.OPS_TEST_BASE_URL || 'http://127.0.0.1:3001';
const TAG = `lic-${Date.now()}`;
const ADMIN_EMAIL = `${TAG}-admin@test.mesa.local`;
const PASSWORD = 'TestLicense!99';
const OWNER_EMAIL = `${TAG}-owner@test.mesa.local`;
const OWNER_PASSWORD = 'OwnerPass1';

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
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

async function api(method, pathName, { body, cookie, headers } = {}) {
  const res = await fetch(`${BASE}${pathName}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json, cookie: cookiesFromResponse(res) };
}

async function main() {
  const env = loadEnv(ENV_FILE);
  if (!env.MESA_LICENSE_LEASE_SECRET) {
    record('env.MESA_LICENSE_LEASE_SECRET', false, 'missing in env file');
  } else {
    record('env.MESA_LICENSE_LEASE_SECRET', true);
  }
  process.env.MESA_LICENSE_LEASE_SECRET = env.MESA_LICENSE_LEASE_SECRET;

  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let adminUserId = null;
  let adminAccountId = null;
  let cloudRestaurantId = null;
  let onPremRestaurantId = null;
  let installCode = null;
  let checkinCredential = null;
  let ownerUserId = null;

  try {
    const ping = await api('GET', '/ops/login');
    record('ops reachable', ping.status === 200, `status=${ping.status}`);

    const { data: userData, error: createError } = await sb.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (createError || !userData.user) throw new Error(createError?.message || 'create admin user');
    adminUserId = userData.user.id;
    const { data: account, error: accErr } = await sb
      .from('platform_admin_accounts')
      .insert({ user_id: adminUserId, role: 'admin', display_name: 'License UAT' })
      .select('id')
      .single();
    if (accErr) throw new Error(accErr.message);
    adminAccountId = account.id;

    const login = await api('POST', '/api/ops/auth/login', {
      body: { email: ADMIN_EMAIL, password: PASSWORD },
    });
    record('ops login', login.status === 200 && Boolean(login.sessionCookie || login.cookie), `status=${login.status}`);
    const cookie = login.sessionCookie || login.cookie;

    // Cloud create still works
    const cloudCreate = await api('POST', '/api/ops/restaurants', {
      cookie,
      body: {
        deploymentMode: 'cloud',
        restaurantName: `Cloud ${TAG}`,
        email: `${TAG}-cloud-owner@test.mesa.local`,
        password: OWNER_PASSWORD,
        printLocale: 'pt',
        countryCode: 'PT',
        slug: `cloud-${TAG}`,
      },
    });
    cloudRestaurantId = cloudCreate.json?.restaurantId || null;
    record(
      'cloud createRestaurant',
      cloudCreate.status === 200 && Boolean(cloudRestaurantId),
      `status=${cloudCreate.status} err=${cloudCreate.json?.error || ''}`,
    );

    // Cloud suspend via licenses API (sole UI surface)
    const cloudSuspend = await api('POST', `/api/ops/licenses/${cloudRestaurantId}/suspend`, {
      cookie,
      body: { reason: 'uat cloud suspend' },
    });
    record('cloud licenses suspend', cloudSuspend.status === 200, `status=${cloudSuspend.status}`);
    const { data: cloudRow } = await sb
      .from('restaurants')
      .select('suspended_at, suspension_reason, deployment_mode')
      .eq('id', cloudRestaurantId)
      .single();
    record(
      'cloud suspended_at set',
      isRestaurantSuspended(cloudRow?.suspended_at) && cloudRow?.deployment_mode === 'cloud',
      cloudRow?.suspension_reason || '',
    );
    const cloudResume = await api('POST', `/api/ops/licenses/${cloudRestaurantId}/resume`, { cookie });
    record('cloud licenses resume', cloudResume.status === 200, `status=${cloudResume.status}`);

    // On-prem register
    const reg = await api('POST', '/api/ops/restaurants', {
      cookie,
      body: {
        deploymentMode: 'on_prem',
        restaurantName: `OnPrem ${TAG}`,
        email: OWNER_EMAIL,
        printLocale: 'pt',
        countryCode: 'PT',
        slug: `onprem-${TAG}`,
        licenseValidUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
    });
    onPremRestaurantId = reg.json?.restaurantId || null;
    record(
      'on_prem register',
      reg.status === 200 && Boolean(onPremRestaurantId) && reg.json?.deploymentMode === 'on_prem',
      `status=${reg.status} err=${reg.error || reg.json?.error || ''}`,
    );

    const { data: pendingRow } = await sb
      .from('restaurants')
      .select('owner_id, deployment_mode, license_valid_until')
      .eq('id', onPremRestaurantId)
      .single();
    record(
      'on_prem registry has null owner_id',
      pendingRow?.owner_id == null && pendingRow?.deployment_mode === 'on_prem',
      `owner=${pendingRow?.owner_id}`,
    );

    // Issue install code
    const issue = await api('POST', `/api/ops/licenses/${onPremRestaurantId}/installations`, { cookie });
    installCode = issue.json?.code || null;
    record('issue install code', issue.status === 200 && Boolean(installCode), `status=${issue.status}`);

    // Claim
    const claim = await api('POST', '/api/platform/license/claim', {
      body: { code: installCode, ownerPassword: OWNER_PASSWORD },
    });
    checkinCredential = claim.json?.checkinCredential || null;
    record(
      'claim installation',
      claim.status === 200 && Boolean(checkinCredential) && Boolean(claim.json?.leaseToken),
      `status=${claim.status} err=${claim.json?.error || ''}`,
    );
    ownerUserId = (
      await sb.from('restaurants').select('owner_id').eq('id', onPremRestaurantId).single()
    ).data?.owner_id;
    record('claim sets owner_id', Boolean(ownerUserId));

    // Extend +1m
    const before = (
      await sb.from('restaurants').select('license_valid_until').eq('id', onPremRestaurantId).single()
    ).data?.license_valid_until;
    const extend = await api('POST', `/api/ops/licenses/${onPremRestaurantId}/extend`, {
      cookie,
      body: { period: '1m' },
    });
    const after = extend.json?.licenseValidUntil;
    record(
      'extend +1m',
      extend.status === 200 && after && Date.parse(after) > Date.parse(before),
      `${before} → ${after}`,
    );

    // Force suspend + check-in carries force
    const forceSus = await api('POST', `/api/ops/licenses/${onPremRestaurantId}/suspend`, {
      cookie,
      body: { reason: 'ops force' },
    });
    record('on_prem force suspend', forceSus.status === 200);
    const checkInForced = await api('POST', '/api/platform/license/check-in', {
      headers: { Authorization: `Bearer ${checkinCredential}` },
      body: {},
    });
    record(
      'check-in returns desiredSuspended',
      checkInForced.status === 200 && checkInForced.json?.desiredSuspended === true,
      `status=${checkInForced.status} desired=${checkInForced.json?.desiredSuspended}`,
    );
    record(
      'check-in lease force_suspended',
      checkInForced.json?.lease?.force_suspended === true,
    );

    // Resume + check-in clears force
    const resume = await api('POST', `/api/ops/licenses/${onPremRestaurantId}/resume`, { cookie });
    record('on_prem resume', resume.status === 200);
    const checkInOk = await api('POST', '/api/platform/license/check-in', {
      headers: { Authorization: `Bearer ${checkinCredential}` },
      body: {},
    });
    record(
      'check-in after resume not forced',
      checkInOk.status === 200 && checkInOk.json?.desiredSuspended === false,
    );

    // Apply lease locally (same DB) and materialize healthy → clear
    await sb
      .from('restaurants')
      .update({
        license_lease_token: checkInOk.json.leaseToken,
        license_checked_at: checkInOk.json.lease.server_time,
        license_lease_until: checkInOk.json.lease.lease_until,
        license_valid_until: checkInOk.json.licenseValidUntil,
        suspended_at: new Date().toISOString(),
        suspension_reason: SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED,
      })
      .eq('id', onPremRestaurantId);

    const { data: localRow } = await sb
      .from('restaurants')
      .select(
        'id, suspended_at, suspension_reason, license_valid_until, license_checked_at, license_lease_until, license_lease_token, deployment_mode',
      )
      .eq('id', onPremRestaurantId)
      .single();

    const decisionClear = decideLicenseMaterialize({
      now: new Date(),
      restaurantId: localRow.id,
      currentlySuspended: true,
      forceSuspended: false,
      forceReason: localRow.suspension_reason,
      licenseValidUntil: localRow.license_valid_until,
      licenseCheckedAt: localRow.license_checked_at,
      licenseLeaseUntil: localRow.license_lease_until,
      leaseToken: localRow.license_lease_token,
      leaseSecret: env.MESA_LICENSE_LEASE_SECRET,
      deploymentMode: 'on_prem',
    });
    record('materialize clears offline grace after fresh lease', decisionClear.action === 'clear', JSON.stringify(decisionClear));

    // Offline grace exceeded materialize
    const oldServer = new Date(Date.now() - LICENSE_OFFLINE_GRACE_MS - 60_000);
    // Re-sign via check-in then rewind lease_until in decide using old claims — unit already covers;
    // here assert decide with past lease_until from stored token after tampering lease fields only
    // (invalidates token) → lease_invalid suspend
    const decisionInvalid = decideLicenseMaterialize({
      now: new Date(),
      restaurantId: localRow.id,
      currentlySuspended: false,
      forceSuspended: false,
      forceReason: null,
      licenseValidUntil: localRow.license_valid_until,
      licenseCheckedAt: oldServer.toISOString(),
      licenseLeaseUntil: oldServer.toISOString(),
      leaseToken: 'not.a.valid.token',
      leaseSecret: env.MESA_LICENSE_LEASE_SECRET,
      deploymentMode: 'on_prem',
    });
    record(
      'materialize suspends invalid lease',
      decisionInvalid.action === 'suspend',
      JSON.stringify(decisionInvalid),
    );

    // Licenses list includes restaurant
    const list = await api('GET', `/api/ops/licenses?q=${encodeURIComponent(TAG)}`, { cookie });
    const found = (list.json?.items || []).some((i) => i.id === onPremRestaurantId);
    record('licenses list finds on_prem', list.status === 200 && found);

    // Revoke installation
    const { data: claimedInst } = await sb
      .from('restaurant_installations')
      .select('id')
      .eq('restaurant_id', onPremRestaurantId)
      .eq('status', 'claimed')
      .maybeSingle();
    const revoke = await api(
      'POST',
      `/api/ops/licenses/${onPremRestaurantId}/installations/${claimedInst.id}/revoke`,
      { cookie },
    );
    record('revoke claimed installation', revoke.status === 200);
    const checkInRevoked = await api('POST', '/api/platform/license/check-in', {
      headers: { Authorization: `Bearer ${checkinCredential}` },
      body: {},
    });
    record('check-in fails after revoke', checkInRevoked.status === 401, `status=${checkInRevoked.status}`);

    // Detail page no longer has suspend form posting path — already verified in static check;
    // API thin wrappers still work for cloud compat:
    const wrapSuspend = await api('POST', `/api/ops/restaurants/${cloudRestaurantId}/suspend`, {
      cookie,
      body: { reason: 'wrapper' },
    });
    record('legacy restaurant suspend wrapper', wrapSuspend.status === 200);
    await api('POST', `/api/ops/restaurants/${cloudRestaurantId}/resume`, { cookie });
  } catch (e) {
    record('fatal', false, e instanceof Error ? e.message : String(e));
  } finally {
    // cleanup
    try {
      if (onPremRestaurantId) {
        await sb.from('restaurant_installations').delete().eq('restaurant_id', onPremRestaurantId);
        await sb.from('restaurants').delete().eq('id', onPremRestaurantId);
      }
      if (cloudRestaurantId) {
        await sb.from('restaurants').delete().eq('id', cloudRestaurantId);
      }
      if (ownerUserId) await sb.auth.admin.deleteUser(ownerUserId);
      // cloud owner email user
      const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of users?.users || []) {
        if (u.email?.includes(TAG)) await sb.auth.admin.deleteUser(u.id);
      }
      if (adminAccountId) await sb.from('platform_admin_accounts').delete().eq('id', adminAccountId);
      if (adminUserId) await sb.auth.admin.deleteUser(adminUserId);
      record('cleanup', true);
    } catch (e) {
      record('cleanup', false, e instanceof Error ? e.message : String(e));
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main();
