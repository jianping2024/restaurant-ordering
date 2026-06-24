/**
 * Integration checks for restaurant suspension enforcement.
 * Usage: bash scripts/run-suspension-enforcement-tests.sh
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isRestaurantSuspended } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerRestaurantForApi } from '@/lib/customer-session-context';

const ROOT = resolve(import.meta.dirname, '..');
const ENV_FILE = resolve(ROOT, '.env.local');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

function loadEnvFile() {
  const text = readFileSync(ENV_FILE, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

type CaseResult = { name: string; status: 'pass' | 'fail' | 'skip'; detail?: string };

const results: CaseResult[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, status: 'pass', detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string) {
  results.push({ name, status: 'fail', detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

function skip(name: string, detail: string) {
  results.push({ name, status: 'skip', detail });
  console.log(`SKIP  ${name} — ${detail}`);
}

async function main() {
  loadEnvFile();

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error('Cannot create admin client:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const { data: restaurant, error: pickError } = await admin
    .from('restaurants')
    .select('id, slug, suspended_at, suspension_reason')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (pickError) {
    console.error('Failed to load test restaurant:', pickError.message);
    process.exit(1);
  }
  if (!restaurant?.slug) {
    console.error('No restaurant in database for integration tests');
    process.exit(1);
  }

  const slug = restaurant.slug as string;
  const restaurantId = restaurant.id as string;
  const originalSuspendedAt = (restaurant.suspended_at as string | null) ?? null;
  const originalReason = (restaurant.suspension_reason as string | null) ?? null;

  console.log(`\nUsing restaurant slug=${slug} id=${restaurantId}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  // --- DB column + helper ---
  try {
    const { error: colProbeError } = await admin
      .from('restaurants')
      .select('suspended_at, suspension_reason')
      .eq('id', restaurantId)
      .single();
    if (colProbeError?.message?.includes('suspended_at')) {
      fail('DB migration: suspended_at column', colProbeError.message);
    } else if (colProbeError) {
      fail('DB migration: suspended_at column', colProbeError.message);
    } else {
      pass('DB migration: suspended_at column');
    }
  } catch (e) {
    fail('DB migration: suspended_at column', e instanceof Error ? e.message : String(e));
  }

  try {
    assert.equal(isRestaurantSuspended(null), false);
    assert.equal(isRestaurantSuspended('2026-01-01T00:00:00Z'), true);
    pass('Helper isRestaurantSuspended');
  } catch (e) {
    fail('Helper isRestaurantSuspended', e instanceof Error ? e.message : String(e));
  }

  async function setSuspended(active: boolean) {
    const { error } = await admin
      .from('restaurants')
      .update({
        suspended_at: active ? new Date().toISOString() : null,
        suspension_reason: active ? '自动化测试暂停' : null,
      })
      .eq('id', restaurantId);
    if (error) throw new Error(error.message);
  }

  // --- Suspended state ---
  try {
    await setSuspended(true);
    const { data: verifyRow } = await admin
      .from('restaurants')
      .select('suspended_at')
      .eq('id', restaurantId)
      .single();
    if (!isRestaurantSuspended(verifyRow?.suspended_at as string | null)) {
      fail('Setup suspended state', 'suspended_at not persisted before API checks');
    }
  } catch (e) {
    fail('Setup suspended state', e instanceof Error ? e.message : String(e));
    printSummary();
    process.exit(1);
  }

  try {
    const gate = await loadCustomerRestaurantForApi(admin, slug);
    assert.equal(gate.ok, false);
    if (!gate.ok) {
      assert.equal(gate.status, 403);
      assert.equal(gate.error, 'restaurant_suspended');
    }
    pass('Suspended: loadCustomerRestaurantForApi returns 403');
  } catch (e) {
    fail('Suspended: loadCustomerRestaurantForApi returns 403', e instanceof Error ? e.message : String(e));
  }

  for (const path of [
    `/api/restaurants/${slug}/customer/session`,
    `/api/restaurants/${slug}/customer/bill`,
  ]) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 403 && json.error === 'restaurant_suspended') {
        pass(`Suspended: GET ${path}`, '403 restaurant_suspended');
      } else {
        const bodyPreview = JSON.stringify(json).slice(0, 120);
        fail(`Suspended: GET ${path}`, `status=${res.status} body=${bodyPreview}`);
      }
    } catch (e) {
      fail(`Suspended: GET ${path}`, e instanceof Error ? e.message : String(e));
    }
  }

  try {
    const res = await fetch(`${BASE_URL}/api/restaurants/${slug}/orders/append`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_id: '00000000-0000-4000-8000-000000000001', items: [] }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 403 && json.error === 'restaurant_suspended') {
      pass('Suspended: POST orders/append', '403 restaurant_suspended');
    } else {
      fail('Suspended: POST orders/append', `status=${res.status} body.error=${json.error}`);
    }
  } catch (e) {
    fail('Suspended: POST orders/append', e instanceof Error ? e.message : String(e));
  }

  try {
    const res = await fetch(`${BASE_URL}/${slug}/menu`, { cache: 'no-store' });
    const html = await res.text();
    if (res.status === 200 && html.includes('暂时无法提供服务')) {
      pass('Suspended: menu page shows maintenance');
    } else {
      fail('Suspended: menu page shows maintenance', `status=${res.status}, hasMaintenance=${html.includes('暂时无法提供服务')}`);
    }
  } catch (e) {
    fail('Suspended: menu page shows maintenance', e instanceof Error ? e.message : String(e));
  }

  try {
    const res = await fetch(`${BASE_URL}/${slug}/bill`, { cache: 'no-store' });
    const html = await res.text();
    if (res.status === 200 && html.includes('暂时无法提供服务')) {
      pass('Suspended: bill page shows maintenance');
    } else {
      fail('Suspended: bill page shows maintenance', `status=${res.status}, hasMaintenance=${html.includes('暂时无法提供服务')}`);
    }
  } catch (e) {
    fail('Suspended: bill page shows maintenance', e instanceof Error ? e.message : String(e));
  }

  // Staff login
  const { data: staffRow } = await admin
    .from('restaurant_staff_accounts')
    .select('email')
    .eq('restaurant_id', restaurantId)
    .is('disabled_at', null)
    .limit(1)
    .maybeSingle();

  if (staffRow?.email) {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: staffRow.email, password: 'wrong-password-for-test' }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (json.error === 'restaurant_suspended') {
        pass('Suspended: staff login blocked', '403 restaurant_suspended');
      } else if (res.status === 401) {
        skip('Suspended: staff login blocked', 'need valid staff password to distinguish from invalid_credentials');
      } else {
        fail('Suspended: staff login blocked', `status=${res.status} error=${json.error}`);
      }
    } catch (e) {
      fail('Suspended: staff login blocked', e instanceof Error ? e.message : String(e));
    }
  } else {
    skip('Suspended: staff login blocked', 'no staff account in DB');
  }

  // --- Active state ---
  try {
    await setSuspended(false);
    const gate = await loadCustomerRestaurantForApi(admin, slug);
    assert.equal(gate.ok, true);
    pass('Active: loadCustomerRestaurantForApi allows access');
  } catch (e) {
    fail('Active: loadCustomerRestaurantForApi allows access', e instanceof Error ? e.message : String(e));
  }

  try {
    const res = await fetch(`${BASE_URL}/api/restaurants/${slug}/customer/session`, {
      cache: 'no-store',
    });
    if (res.status === 200) {
      pass('Active: GET customer/session', `HTTP ${res.status}`);
    } else {
      fail('Active: GET customer/session', `expected 200, got ${res.status}`);
    }
  } catch (e) {
    fail('Active: GET customer/session', e instanceof Error ? e.message : String(e));
  }

  try {
    const res = await fetch(`${BASE_URL}/${slug}/menu`, { cache: 'no-store' });
    const html = await res.text();
    if (res.status === 200 && !html.includes('暂时无法提供服务')) {
      pass('Active: menu page renders normally');
    } else {
      fail('Active: menu page renders normally', `status=${res.status}, maintenance=${html.includes('暂时无法提供服务')}`);
    }
  } catch (e) {
    fail('Active: menu page renders normally', e instanceof Error ? e.message : String(e));
  }

  // Restore original suspension state
  try {
    await admin
      .from('restaurants')
      .update({
        suspended_at: originalSuspendedAt,
        suspension_reason: originalReason,
      })
      .eq('id', restaurantId);
    pass('Cleanup: restored original suspension state');
  } catch (e) {
    fail('Cleanup: restored original suspension state', e instanceof Error ? e.message : String(e));
  }

  printSummary();
  const failed = results.filter((r) => r.status === 'fail').length;
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  console.log('\n--- Integration summary ---');
  console.log(`PASS: ${passed}  FAIL: ${failed}  SKIP: ${skipped}  TOTAL: ${results.length}`);
}

void main();
