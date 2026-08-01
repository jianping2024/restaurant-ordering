#!/usr/bin/env node
/**
 * Print-agent local smoke (API-level; optional fake-printer ports).
 *
 * Does NOT wipe DB. Uses product/owner APIs + optional agent JWT env.
 *
 * Usage:
 *   node scripts/mesa-print-smoke.mjs
 *   node scripts/mesa-print-smoke.mjs --base http://localhost:3000 --jar owner
 *
 * Checks:
 *   1) stack: web up
 *   2) owner login (mesa-local-uat jar)
 *   3) GET /api/print-agent/print-jobs/recent — shape
 *   4) optional: fake printer TCP ports 19100–19102
 *   5) optional: pending-jobs with PRINT_AGENT JWT if MESA_PRINT_SMOKE_JWT set
 *
 * Full ESC/POS e2e still needs: dashboard pairing + `npm run print` agent.
 */
import { spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const uat = join(ROOT, 'scripts/mesa-local-uat.mjs');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

function runUat(args, env = {}) {
  const r = spawnSync(process.execPath, [uat, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function probePort(port, host = '127.0.0.1', timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const done = (ok, error) => {
      socket.destroy();
      resolve({ port, ok, error: error || null });
    };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false, 'timeout'));
    socket.on('error', (e) => done(false, e.message));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const base = args.base || process.env.MESA_UAT_BASE || 'http://localhost:3000';
  const jar = args.jar || 'owner';
  const env = { MESA_UAT_BASE: base };
  const results = [];

  const health = runUat(['stack-health'], env);
  const healthJson = parseJson(health.stdout);
  results.push({
    id: 'stack_web',
    pass: Boolean(healthJson?.checks?.find((c) => c.name === 'web')?.ok),
    note: healthJson?.ready ? 'web ready' : health.stdout.slice(0, 200),
  });

  const login = runUat(['login', '--role', 'owner', '--jar', jar], env);
  results.push({
    id: 'owner_login',
    pass: login.status === 0,
    note: login.status === 0 ? `jar=${jar}` : (login.stderr || login.stdout).slice(0, 240),
  });

  let recent = null;
  if (login.status === 0) {
    const req = runUat(['req', 'GET', '/api/print-agent/print-jobs/recent', '--jar', jar, '--allow-error'], env);
    recent = parseJson(req.stdout);
    const jobs = recent?.json?.jobs ?? recent?.json?.data ?? recent?.json;
    const shapeOk =
      req.status === 0 &&
      recent &&
      (Array.isArray(jobs) || (recent.json && typeof recent.json === 'object'));
    results.push({
      id: 'recent_print_jobs',
      pass: Boolean(shapeOk && recent.status >= 200 && recent.status < 300),
      note: `status=${recent?.status} keys=${recent?.json ? Object.keys(recent.json).join(',') : 'none'}`,
    });
  } else {
    results.push({ id: 'recent_print_jobs', pass: false, note: 'skipped: login failed' });
  }

  const ports = await Promise.all([19100, 19101, 19102].map((p) => probePort(p)));
  const anyPrinter = ports.some((p) => p.ok);
  results.push({
    id: 'fake_printer_ports',
    pass: true, // soft: inform only
    soft: true,
    note: anyPrinter
      ? `listening: ${ports.filter((p) => p.ok).map((p) => p.port).join(',')}`
      : 'none on 19100-19102 (run npm run print / print-dev.sh up for ESC/POS e2e)',
  });

  const jwt = process.env.MESA_PRINT_SMOKE_JWT || args.jwt;
  if (jwt) {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/print-agent/pending-jobs`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    results.push({
      id: 'pending_jobs_jwt',
      pass: res.status >= 200 && res.status < 300,
      note: `status=${res.status} jobs=${Array.isArray(json?.jobs) ? json.jobs.length : 'n/a'}`,
    });
  } else {
    results.push({
      id: 'pending_jobs_jwt',
      pass: true,
      soft: true,
      note: 'skip: set MESA_PRINT_SMOKE_JWT for agent-auth pending-jobs check',
    });
  }

  const hardFails = results.filter((r) => !r.pass && !r.soft);
  const report = {
    ok: hardFails.length === 0,
    base,
    results,
    next: hardFails.length
      ? 'fix login/API first'
      : 'For full print e2e: pair agent + npm run print, then trigger a receipt',
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e?.message || e) }));
  process.exit(1);
});
