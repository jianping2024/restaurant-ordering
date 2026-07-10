#!/usr/bin/env node
/**
 * Guest append load test (waiter_flow: false, no staff cookie).
 *
 * Models 50 stores × ~133 open tables (800 guests @ 6/table). Tiers:
 *   p0 — smoke (≤10 tables, 1 append each)
 *   p1 — peak minute (~10% tables order within 60s)
 *   p2 — opening rush (~20% tables within 120s; 10% double-concurrent per table)
 *
 * Usage:
 *   node scripts/discover-load-test-targets.mjs --out scripts/load-test-targets.json
 *   node scripts/load-test-guest-append.mjs --targets scripts/load-test-targets.json --tier p1
 *
 * Note: append is rate-limited to 60/IP/min. Full P1/P2 needs stage bypass or many source IPs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const ROOT = resolve(import.meta.dirname, '..');

/** @type {Record<string, { pctTables: number; burstSec: number; doublePct: number; maxTables: number; label: string }>} */
const TIERS = {
  p0: {
    label: 'smoke',
    pctTables: 1,
    burstSec: 5,
    doublePct: 0,
    maxTables: 10,
  },
  p1: {
    label: 'peak minute (10% tables in 60s)',
    pctTables: 0.1,
    burstSec: 60,
    doublePct: 0,
    maxTables: 50 * 133,
  },
  p2: {
    label: 'opening rush (20% tables in 120s, 10% double-append)',
    pctTables: 0.2,
    burstSec: 120,
    doublePct: 0.1,
    maxTables: 50 * 133,
  },
};

const APPEND_RATE_LIMIT_PER_MIN = 120;

function parseArgs(argv) {
  const opts = {
    base: process.env.TEST_BASE_URL || 'http://localhost:3000',
    targetsPath: resolve(ROOT, 'scripts/load-test-targets.json'),
    tier: 'p0',
    stores: 50,
    tablesPerStore: 133,
    note: 'load-test',
    e2e: false,
    dryRun: false,
    cleanup: false,
    staffEmail: process.env.TEST_STAFF_EMAIL || 'qiantai@mesa.in',
    staffPassword: process.env.TEST_STAFF_PASSWORD || '',
    resultsOut: '',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base' && argv[i + 1]) opts.base = argv[++i];
    else if (a === '--targets' && argv[i + 1]) opts.targetsPath = resolve(process.cwd(), argv[++i]);
    else if (a === '--tier' && argv[i + 1]) opts.tier = argv[++i].toLowerCase();
    else if (a === '--stores' && argv[i + 1]) opts.stores = Number(argv[++i]);
    else if (a === '--tables-per-store' && argv[i + 1]) opts.tablesPerStore = Number(argv[++i]);
    else if (a === '--note' && argv[i + 1]) opts.note = argv[++i];
    else if (a === '--results' && argv[i + 1]) opts.resultsOut = resolve(process.cwd(), argv[++i]);
    else if (a === '--e2e') opts.e2e = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--cleanup') opts.cleanup = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/load-test-guest-append.mjs [options]

Options:
  --targets PATH         JSON from discover-load-test-targets.mjs
  --tier p0|p1|p2        Traffic preset (default p0)
  --stores N             Fleet size for model (default 50)
  --tables-per-store N   Active tables per store (default 133 ≈ 800 guests / 6)
  --base URL
  --note TEXT            Append note tag for cleanup
  --e2e                  Also POST station-tickets/auto after each append
  --dry-run              Print plan only
  --cleanup              Staff void test batches after run (needs TEST_STAFF_PASSWORD)
  --results PATH         Write JSON summary
`);
      process.exit(0);
    }
  }
  if (!TIERS[opts.tier]) {
    console.error(`Unknown tier: ${opts.tier}`);
    process.exit(1);
  }
  return opts;
}

function loadTargets(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const targets = raw.targets || raw;
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error(`No targets in ${path}`);
  }
  for (const t of targets) {
    if (!t.slug || !t.table_id || !t.menu_item_id) {
      throw new Error(`Invalid target: ${JSON.stringify(t)}`);
    }
  }
  return targets;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function buildPlan(targets, tierKey, stores, tablesPerStore) {
  const tier = TIERS[tierKey];
  const modelTables = Math.min(stores * tablesPerStore, tier.maxTables);
  const desired = Math.max(1, Math.round(modelTables * tier.pctTables));
  const pool = shuffle(targets);
  const selected = [];
  for (let i = 0; i < desired; i++) {
    selected.push(pool[i % pool.length]);
  }
  const jobs = [];
  for (const target of selected) {
    jobs.push({ target, concurrent: 1 });
    if (tier.doublePct > 0 && Math.random() < tier.doublePct) {
      jobs.push({ target, concurrent: 2 });
    }
  }
  const requestCount = jobs.length;
  const targetRps = requestCount / tier.burstSec;
  return {
    tier,
    modelTables,
    desiredTables: desired,
    availableTargets: targets.length,
    requestCount,
    targetRps,
    jobs,
    coveragePct: Math.round((Math.min(desired, targets.length) / desired) * 10000) / 100,
  };
}

async function guestAppend(base, target, note) {
  const url = `${base}/api/restaurants/${target.slug}/orders/append`;
  const body = {
    table_id: target.table_id,
    items: [{ menu_item_id: target.menu_item_id, qty: 1, note }],
    waiter_flow: false,
  };
  const t0 = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const ms = performance.now() - t0;
  const json = await res.json().catch(() => ({}));
  return {
    ok: res.ok && json.ok === true,
    status: res.status,
    error: json.error || null,
    ms,
    order_id: json.order_id,
    batch_id: json.batch_id,
    enqueue_token: json.enqueue_token,
    slug: target.slug,
    table_id: target.table_id,
  };
}

async function guestEnqueue(base, slug, orderId, batchId, token) {
  const url = `${base}/api/restaurants/${slug}/station-tickets/auto`;
  const t0 = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, batch_id: batchId, enqueue_token: token }),
  });
  const ms = performance.now() - t0;
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, error: json.error || null, ms };
}

async function runBurst(base, plan, note, e2e) {
  const results = [];
  const start = performance.now();
  const staggerMs = plan.jobs.length > 1 ? (plan.tier.burstSec * 1000) / plan.jobs.length : 0;

  const tasks = plan.jobs.map((job, idx) =>
    (async () => {
      if (staggerMs > 0 && idx > 0) {
        await new Promise((r) => setTimeout(r, Math.round(idx * staggerMs)));
      }
      const append = await guestAppend(base, job.target, note);
      results.push({ kind: 'append', ...append });
      if (e2e && append.ok && append.enqueue_token) {
        const enq = await guestEnqueue(
          base,
          append.slug,
          append.order_id,
          append.batch_id,
          append.enqueue_token,
        );
        results.push({ kind: 'enqueue', slug: append.slug, table_id: append.table_id, ...enq });
      }
    })(),
  );

  await Promise.all(tasks);
  const elapsedSec = (performance.now() - start) / 1000;
  return { results, elapsedSec };
}

function summarize(results, plan, elapsedSec) {
  const appends = results.filter((r) => r.kind === 'append');
  const latencies = appends.map((r) => r.ms).sort((a, b) => a - b);
  const errors = {};
  for (const r of appends) {
    const key = r.ok ? 'ok' : `${r.status}:${r.error || 'unknown'}`;
    errors[key] = (errors[key] || 0) + 1;
  }
  const ok = appends.filter((r) => r.ok).length;
  return {
    tier: plan.tier.label,
    requests: appends.length,
    ok,
    fail: appends.length - ok,
    elapsed_sec: Math.round(elapsedSec * 100) / 100,
    achieved_rps: Math.round((appends.length / elapsedSec) * 100) / 100,
    target_rps: Math.round(plan.targetRps * 100) / 100,
    latency_ms: {
      p50: Math.round(percentile(latencies, 50)),
      p95: Math.round(percentile(latencies, 95)),
      p99: Math.round(percentile(latencies, 99)),
      max: Math.round(latencies[latencies.length - 1] || 0),
    },
    errors,
    successful_appends: appends
      .filter((r) => r.ok)
      .map((r) => ({
        slug: r.slug,
        table_id: r.table_id,
        order_id: r.order_id,
        batch_id: r.batch_id,
      })),
  };
}

async function staffLogin(base, email, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(`staff login failed HTTP ${res.status}`);
  const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  return cookie;
}

async function cleanupBatch(base, cookie, slug, tableId, orderId, batchId) {
  const detailRes = await fetch(`${base}/api/restaurants/${slug}/staff/waiter/tables/${tableId}`, {
    headers: { Cookie: cookie },
  });
  if (!detailRes.ok) return false;
  const detail = await detailRes.json();
  let order = null;
  for (const o of detail.orders || []) {
    if (o.id === orderId) {
      order = o;
      break;
    }
  }
  if (!order) return false;
  let idx = -1;
  for (let i = 0; i < (order.items || []).length; i++) {
    if (order.items[i]?.batch_id === batchId) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return false;
  const decRes = await fetch(
    `${base}/api/restaurants/${slug}/staff/waiter/orders/${orderId}/decrement-item`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        item_index: idx,
        updated_at: order.updated_at,
        void_reason: 'staff_mistake',
      }),
    },
  );
  return decRes.ok;
}

async function main() {
  const opts = parseArgs(process.argv);
  const targets = loadTargets(opts.targetsPath);
  const plan = buildPlan(targets, opts.tier, opts.stores, opts.tablesPerStore);

  console.log('=== Guest append load test ===');
  console.log(`BASE=${opts.base} tier=${opts.tier} (${plan.tier.label})`);
  console.log(
    `Model: ${opts.stores} stores × ${opts.tablesPerStore} tables → ${plan.modelTables} active tables`,
  );
  console.log(
    `Plan: ${plan.requestCount} append requests in ~${plan.tier.burstSec}s (target ~${plan.targetRps} RPS)`,
  );
  console.log(
    `Targets file: ${plan.availableTargets} entries, coverage ${plan.coveragePct}% of desired ${plan.desiredTables}`,
  );

  if (plan.targetRps > APPEND_RATE_LIMIT_PER_MIN / 60) {
    console.warn(
      `\n⚠ Rate limit: ${APPEND_RATE_LIMIT_PER_MIN}/IP/min (~1 RPS). Target ${plan.targetRps} RPS will hit 429 unless stage bypass or multi-IP.\n`,
    );
  }

  if (opts.dryRun) {
    console.log('Dry run — no requests sent.');
    process.exit(0);
  }

  const { results, elapsedSec } = await runBurst(opts.base, plan, opts.note, opts.e2e);
  const summary = summarize(results, plan, elapsedSec);

  console.log('\n=== Results ===');
  console.log(`Requests: ${summary.requests}  ok: ${summary.ok}  fail: ${summary.fail}`);
  console.log(`Elapsed: ${summary.elapsed_sec}s  achieved RPS: ${summary.achieved_rps}`);
  console.log(
    `Latency ms — p50: ${summary.latency_ms.p50}  p95: ${summary.latency_ms.p95}  p99: ${summary.latency_ms.p99}  max: ${summary.latency_ms.max}`,
  );
  console.log('Errors:', summary.errors);

  if (opts.cleanup && summary.successful_appends.length > 0) {
    if (!opts.staffPassword) {
      console.warn('Skip cleanup: set TEST_STAFF_PASSWORD');
    } else {
      const cookie = await staffLogin(opts.base, opts.staffEmail, opts.staffPassword);
      let cleaned = 0;
      for (const row of summary.successful_appends) {
        const ok = await cleanupBatch(
          opts.base,
          cookie,
          row.slug,
          row.table_id,
          row.order_id,
          row.batch_id,
        );
        if (ok) cleaned++;
      }
      console.log(`Cleanup: ${cleaned}/${summary.successful_appends.length} batches voided`);
    }
  }

  if (opts.resultsOut) {
    writeFileSync(
      opts.resultsOut,
      `${JSON.stringify({ ...summary, meta: { base: opts.base, tier: opts.tier, at: new Date().toISOString() } }, null, 2)}\n`,
    );
    console.log(`Wrote ${opts.resultsOut}`);
  }

  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
