#!/usr/bin/env node
/**
 * Mesa local UAT helper — cookie jar + API assert + stack health.
 *
 * Usage (repo root):
 *   node scripts/mesa-local-uat.mjs stack-health
 *   node scripts/mesa-local-uat.mjs login --role staff
 *   node scripts/mesa-local-uat.mjs login --role owner
 *   node scripts/mesa-local-uat.mjs req GET /api/... --jar staff
 *   node scripts/mesa-local-uat.mjs req POST /api/... --jar staff --body '{"x":1}'
 *   node scripts/mesa-local-uat.mjs wait-json GET /api/... --jar staff --path data.id --timeout-ms 8000
 *   node scripts/mesa-local-uat.mjs assert --status 200 --error null   # reads last JSON from stdin
 *   node scripts/mesa-local-uat.mjs close-session --jar staff --session-id <uuid>
 *
 * Env:
 *   MESA_UAT_BASE (default http://localhost:3000)
 *   MESA_UAT_OPS_BASE (default http://localhost:3001)
 *   MESA_UAT_SLUG (default restaurant-mohnrib5)
 *   MESA_UAT_JAR_DIR (default /tmp/mesa-uat)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = (process.env.MESA_UAT_BASE || 'http://localhost:3000').replace(/\/$/, '');
const OPS_BASE = (process.env.MESA_UAT_OPS_BASE || 'http://localhost:3001').replace(/\/$/, '');
const SLUG = process.env.MESA_UAT_SLUG || 'restaurant-mohnrib5';
const JAR_DIR = process.env.MESA_UAT_JAR_DIR || '/tmp/mesa-uat';

const ACCOUNTS = {
  staff: {
    account: process.env.MESA_UAT_STAFF_ACCOUNT || 'qiantai1',
    password: process.env.MESA_UAT_STAFF_PASSWORD || 'MesaUat1',
  },
  owner: {
    account: process.env.MESA_UAT_OWNER_ACCOUNT || 'baiyun@gmail.com',
    password: process.env.MESA_UAT_OWNER_PASSWORD || '123456',
  },
};

function usage(exit = 1) {
  console.error(`mesa-local-uat commands:
  stack-health
  login --role staff|owner [--jar name] [--account x] [--password y]
  req METHOD PATH [--jar name] [--body JSON] [--header 'K: V']...
  wait-json METHOD PATH --jar name --path a.b [--equals v] [--timeout-ms N] [--interval-ms N]
  assert --status N [--error CODE|null] [--has path]
  close-session --jar name --session-id UUID [--confirm true]
Defaults: base=${BASE} slug=${SLUG} jarDir=${JAR_DIR}`);
  process.exit(exit);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      out._.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function jarPath(name) {
  mkdirSync(JAR_DIR, { recursive: true });
  return join(JAR_DIR, `${name || 'default'}.json`);
}

function loadJar(name) {
  const p = jarPath(name);
  if (!existsSync(p)) return { cookie: '', role: null, base: BASE };
  return JSON.parse(readFileSync(p, 'utf8'));
}

function saveJar(name, data) {
  writeFileSync(jarPath(name), JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2));
}

function mergeSetCookie(existing, setCookies) {
  const map = new Map();
  for (const part of String(existing || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const i = part.indexOf('=');
    if (i > 0) map.set(part.slice(0, i), part);
  }
  for (const raw of setCookies || []) {
    const first = String(raw).split(';')[0].trim();
    const i = first.indexOf('=');
    if (i > 0) map.set(first.slice(0, i), first);
  }
  return [...map.values()].join('; ');
}

function getSetCookie(res) {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function pathGet(obj, dotted) {
  if (!dotted) return obj;
  return String(dotted)
    .split('.')
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

async function probe(url, { method = 'GET', timeoutMs = 2500 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, signal: ctrl.signal, redirect: 'manual' });
    return { ok: res.status > 0, status: res.status, url };
  } catch (e) {
    return { ok: false, status: 0, url, error: e?.name === 'AbortError' ? 'timeout' : String(e?.message || e) };
  } finally {
    clearTimeout(t);
  }
}

async function stackHealth() {
  const checks = [];
  const webHome = await probe(`${BASE}/`, { timeoutMs: 5000 });
  const webLogin = await probe(`${BASE}/api/auth/login`, { method: 'OPTIONS', timeoutMs: 5000 });
  // Home can be cold/slow; login API is the UAT gate.
  const webOk = webLogin.ok || webHome.ok;
  checks.push({ name: 'web', ok: webOk, home: webHome, loginApi: webLogin });
  checks.push({ name: 'ops', ...(await probe(`${OPS_BASE}/`)) });
  checks.push({ name: 'supabase_api', ...(await probe('http://127.0.0.1:54321/')) });
  checks.push({ name: 'supabase_mcp', ...(await probe('http://127.0.0.1:54321/mcp', { method: 'POST' })) });
  checks.push({ name: 'supabase_db_tcp_hint', ok: true, note: 'use supabase-local MCP or psql :54322 for DB asserts' });

  const required = ['web', 'supabase_api', 'supabase_mcp'];
  const failed = checks.filter((c) => required.includes(c.name) && !c.ok);
  const soft = checks.filter((c) => c.name === 'ops' && !c.ok);

  const report = {
    base: BASE,
    opsBase: OPS_BASE,
    slug: SLUG,
    checks,
    ready: failed.length === 0,
    softMissing: soft.map((c) => c.name),
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ready ? 0 : 2);
}

async function api(method, path, { jarName, body, headers = {}, persistJar = true } = {}) {
  const jar = jarName ? loadJar(jarName) : { cookie: '' };
  const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(jar.cookie ? { Cookie: jar.cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    redirect: 'manual',
  });
  const setCookies = getSetCookie(res);
  const nextCookie = mergeSetCookie(jar.cookie, setCookies);
  if (jarName && persistJar && setCookies.length) {
    saveJar(jarName, { ...jar, cookie: nextCookie, base: BASE });
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return {
    status: res.status,
    ok: res.status >= 200 && res.status < 300,
    headers: Object.fromEntries(res.headers.entries()),
    cookie: nextCookie,
    json,
    text,
    url,
  };
}

async function login(args) {
  const role = args.role;
  if (role !== 'staff' && role !== 'owner') usage();
  const jarName = args.jar || role;
  const account = args.account || ACCOUNTS[role].account;
  const password = args.password || ACCOUNTS[role].password;
  const result = await api('POST', '/api/auth/login', {
    jarName,
    body: { account, password },
  });
  if (!result.ok) {
    console.error(JSON.stringify({ error: 'login_failed', role, status: result.status, body: result.json || result.text }, null, 2));
    process.exit(1);
  }
  saveJar(jarName, {
    cookie: result.cookie,
    role,
    account,
    base: BASE,
    slug: SLUG,
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        role,
        jar: jarPath(jarName),
        status: result.status,
        redirect: result.json,
      },
      null,
      2,
    ),
  );
}

async function req(args) {
  const [method, path] = args._;
  if (!method || !path) usage();
  const headers = {};
  const rawHeaders = [].concat(args.header || args.headers || []).filter(Boolean);
  // parseArgs only keeps last --header; support comma-separated or single
  if (typeof args.header === 'string') {
    const i = args.header.indexOf(':');
    if (i > 0) headers[args.header.slice(0, i).trim()] = args.header.slice(i + 1).trim();
  }
  let body;
  if (args.body !== undefined) {
    body = typeof args.body === 'string' ? JSON.parse(args.body) : args.body;
  }
  const result = await api(method.toUpperCase(), path, {
    jarName: args.jar,
    body,
    headers,
  });
  const out = {
    status: result.status,
    ok: result.ok,
    url: result.url,
    error: result.json && typeof result.json === 'object' ? result.json.error ?? null : null,
    json: result.json,
    text: result.json ? undefined : result.text?.slice(0, 2000),
  };
  console.log(JSON.stringify(out, null, 2));
  if (args['expect-status']) {
    const want = Number(args['expect-status']);
    if (result.status !== want) process.exit(1);
  }
  process.exit(result.ok || args['allow-error'] ? 0 : 1);
}

async function waitJson(args) {
  const [method, path] = args._;
  if (!method || !path || !args.path) usage();
  const timeoutMs = Number(args['timeout-ms'] || 8000);
  const intervalMs = Number(args['interval-ms'] || 400);
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await api(method.toUpperCase(), path, { jarName: args.jar });
    const value = pathGet(last.json, args.path);
    const hasValue = value !== undefined && value !== null;
    const equalsOk = args.equals === undefined || String(value) === String(args.equals);
    if (last.ok && hasValue && equalsOk) {
      console.log(JSON.stringify({ ok: true, status: last.status, path: args.path, value, json: last.json }, null, 2));
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: 'wait_json_timeout',
        path: args.path,
        equals: args.equals ?? null,
        lastStatus: last?.status ?? null,
        lastJson: last?.json ?? null,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

function assertCmd(args) {
  const raw = readFileSync(0, 'utf8');
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.error(JSON.stringify({ ok: false, error: 'stdin_not_json' }));
    process.exit(1);
  }
  const status = payload.status ?? payload.statusCode;
  const err = payload.error ?? payload.json?.error ?? null;
  const failures = [];
  if (args.status !== undefined && Number(status) !== Number(args.status)) {
    failures.push(`status want=${args.status} got=${status}`);
  }
  if (args.error !== undefined) {
    const want = args.error === 'null' ? null : args.error;
    if (want !== err) failures.push(`error want=${want} got=${err}`);
  }
  if (args.has) {
    const v = pathGet(payload.json ?? payload, args.has);
    if (v === undefined) failures.push(`missing path ${args.has}`);
  }
  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures, payload }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, status, error: err }, null, 2));
}

async function closeSession(args) {
  if (!args.jar || !args['session-id']) usage();
  const sessionId = args['session-id'];
  const body = {
    session_id: sessionId,
    confirm: args.confirm === undefined ? true : args.confirm === 'true' || args.confirm === true,
  };
  const result = await api('POST', '/api/dashboard/close-table-session', {
    jarName: args.jar,
    body,
  });
  console.log(
    JSON.stringify(
      {
        status: result.status,
        ok: result.ok,
        error: result.json?.error ?? null,
        json: result.json,
      },
      null,
      2,
    ),
  );
  process.exit(result.ok ? 0 : 1);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._.shift();
if (!cmd) usage(0);

switch (cmd) {
  case 'stack-health':
    await stackHealth();
    break;
  case 'login':
    await login(args);
    break;
  case 'req':
    await req(args);
    break;
  case 'wait-json':
    await waitJson(args);
    break;
  case 'assert':
    assertCmd(args);
    break;
  case 'close-session':
    await closeSession(args);
    break;
  default:
    usage();
}
