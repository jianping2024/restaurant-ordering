/**
 * Phase 2/3 manual tests: claimed_by enforcement on PATCH /api/print-agent/jobs/[id]
 * Usage: node scripts/verify-print-agent-claimed-by.mjs [baseUrl]
 * Requires: .env.local with SUPABASE_* and PRINT_AGENT_JWT_SECRET; Next dev on baseUrl (default http://127.0.0.1:3000)
 */
import { createHmac, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  try {
    const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
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
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

function signPrintAgentJwt({ restaurant_id, device_id }, secret, expiresInSec = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    typ: 'print_agent',
    restaurant_id,
    device_id,
    iat: now,
    exp: now + expiresInSec,
  };
  const b64url = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

async function patchJob(base, jwt, jobId, body) {
  const res = await fetch(`${base.replace(/\/$/, '')}/api/print-agent/jobs/${jobId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return { status: res.status, json, raw: JSON.stringify(json) };
}

async function insertPendingJob(admin, restaurantId) {
  const { data, error } = await admin
    .from('print_jobs')
    .insert({
      restaurant_id: restaurantId,
      type: 'order_receipt',
      status: 'pending',
      payload: {
        connection_test: true,
        locale: 'pt',
        lines: [{ display_name: 'claimed_by verify', qty: 1 }],
      },
    })
    .select('id, status, claimed_by')
    .single();
  if (error) throw new Error(`insert job: ${error.message}`);
  return data;
}

async function getJob(admin, jobId) {
  const { data, error } = await admin
    .from('print_jobs')
    .select('id, status, claimed_by')
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw new Error(`get job: ${error.message}`);
  return data;
}

function record(results, id, pass, detail) {
  results.push({ id, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${id}${detail ? ` — ${detail}` : ''}`);
}

loadEnvLocal();

const base = process.argv[2]?.trim() || 'http://127.0.0.1:3000';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.PRINT_AGENT_JWT_SECRET;

if (!url || !serviceKey || !jwtSecret) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or PRINT_AGENT_JWT_SECRET');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const results = [];
const createdJobIds = [];

try {
  const health = await fetch(`${base.replace(/\/$/, '')}/api/print-agent/pending-jobs`, {
    headers: { Authorization: 'Bearer invalid' },
  });
  if (health.status === 404) {
    throw new Error(`API not found at ${base} (404). Start: npm run dev`);
  }
} catch (e) {
  if (e.cause?.code === 'ECONNREFUSED' || e.message?.includes('fetch failed')) {
    console.error(`Cannot reach ${base}. Start: npm run dev`);
    process.exit(1);
  }
  if (e.message?.includes('API not found')) {
    console.error(e.message);
    process.exit(1);
  }
}

const { data: restaurant, error: rErr } = await admin
  .from('restaurants')
  .select('id')
  .limit(1)
  .maybeSingle();

if (rErr || !restaurant?.id) {
  console.error('No restaurant in DB for tests:', rErr?.message);
  process.exit(1);
}

try {
const restaurantId = restaurant.id;
const deviceA = randomUUID();
const deviceB = randomUUID();
const jwtA = signPrintAgentJwt({ restaurant_id: restaurantId, device_id: deviceA }, jwtSecret);
const jwtB = signPrintAgentJwt({ restaurant_id: restaurantId, device_id: deviceB }, jwtSecret);

console.log(`Base: ${base}`);
console.log(`Restaurant: ${restaurantId}`);
console.log('---');

// Test 1–3: A claims; B cannot done; A can done
{
  const job = await insertPendingJob(admin, restaurantId);
  createdJobIds.push(job.id);

  const r1 = await patchJob(base, jwtA, job.id, { status: 'processing' });
  record(results, '1 A pending→processing', r1.status === 200, `status=${r1.status}`);

  const afterClaim = await getJob(admin, job.id);
  record(
    results,
    '1b claimed_by is A',
    afterClaim?.claimed_by === deviceA,
    `claimed_by=${afterClaim?.claimed_by}`,
  );

  const r2 = await patchJob(base, jwtB, job.id, { status: 'done' });
  record(results, '2 B processing→done blocked', r2.status === 409, `status=${r2.status} err=${r2.json?.error}`);

  const mid = await getJob(admin, job.id);
  record(
    results,
    '2b job still processing',
    mid?.status === 'processing' && mid?.claimed_by === deviceA,
    `status=${mid?.status}`,
  );

  const r3 = await patchJob(base, jwtA, job.id, { status: 'done' });
  record(results, '3 A processing→done', r3.status === 200, `status=${r3.status}`);
}

// Test 4–5: A claims; B cannot fail; A can fail
{
  const job = await insertPendingJob(admin, restaurantId);
  createdJobIds.push(job.id);

  await patchJob(base, jwtA, job.id, { status: 'processing' });

  const r4 = await patchJob(base, jwtB, job.id, {
    status: 'failed',
    error_message: 'cross-device test',
  });
  record(results, '4 B processing→failed blocked', r4.status === 409, `status=${r4.status}`);

  const r5 = await patchJob(base, jwtA, job.id, {
    status: 'failed',
    error_message: 'owner device fail',
  });
  record(results, '5 A processing→failed', r5.status === 200, `status=${r5.status}`);
}

// Test 6: B pending→failed without prior claim
{
  const job = await insertPendingJob(admin, restaurantId);
  createdJobIds.push(job.id);

  const r6 = await patchJob(base, jwtB, job.id, {
    status: 'failed',
    error_message: 'routing fail before claim',
  });
  record(results, '6 B pending→failed allowed', r6.status === 200, `status=${r6.status}`);
}

// Test 7: race pending→processing
{
  const job = await insertPendingJob(admin, restaurantId);
  createdJobIds.push(job.id);

  const [ra, rb] = await Promise.all([
    patchJob(base, jwtA, job.id, { status: 'processing' }),
    patchJob(base, jwtB, job.id, { status: 'processing' }),
  ]);
  const ok = (ra.status === 200 && rb.status === 409) || (rb.status === 200 && ra.status === 409);
  record(
    results,
    '7 race claim one wins',
    ok,
    `A=${ra.status} B=${rb.status}`,
  );
}

// Test 8: dashboard retry clears claimed_by (DB path same as retry route)
{
  const job = await insertPendingJob(admin, restaurantId);
  createdJobIds.push(job.id);
  await patchJob(base, jwtA, job.id, { status: 'processing' });
  await patchJob(base, jwtA, job.id, {
    status: 'failed',
    error_message: 'for retry test',
  });

  const { data: retried, error: retryErr } = await admin
    .from('print_jobs')
    .update({ status: 'pending', error_message: null, claimed_by: null })
    .eq('id', job.id)
    .eq('status', 'failed')
    .select('id, status, claimed_by')
    .maybeSingle();

  record(
    results,
    '8 retry clears claimed_by',
    !retryErr && retried?.status === 'pending' && retried?.claimed_by == null,
    retryErr?.message || `claimed_by=${retried?.claimed_by}`,
  );

  const r8b = await patchJob(base, jwtB, job.id, { status: 'processing' });
  record(results, '8b B can claim after retry', r8b.status === 200, `status=${r8b.status}`);
}

console.log('---');
const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error(`${failed.length}/${results.length} failed`);
  process.exit(1);
}
console.log(`All ${results.length} manual checks passed.`);
} finally {
  if (createdJobIds.length) {
    await admin.from('print_jobs').delete().in('id', createdJobIds);
  }
}

