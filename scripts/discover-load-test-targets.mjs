#!/usr/bin/env node
/**
 * Discover open tables + menu items for guest append load tests (staff login required).
 *
 * Usage:
 *   TEST_STAFF_PASSWORD=secret node scripts/discover-load-test-targets.mjs \
 *     --slug restaurant-mo9y14xc \
 *     --out scripts/load-test-targets.json
 *
 * Multiple slugs:
 *   node scripts/discover-load-test-targets.mjs --slug a,b,c --out targets.json
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

function parseArgs(argv) {
  const opts = {
    base: process.env.TEST_BASE_URL || 'http://localhost:3000',
    email: process.env.TEST_STAFF_EMAIL || 'qiantai@mesa.in',
    password: process.env.TEST_STAFF_PASSWORD || '',
    slugs: ['restaurant-mo9y14xc'],
    out: resolve(ROOT, 'scripts/load-test-targets.json'),
    maxPerSlug: 200,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base' && argv[i + 1]) opts.base = argv[++i];
    else if (a === '--email' && argv[i + 1]) opts.email = argv[++i];
    else if (a === '--password' && argv[i + 1]) opts.password = argv[++i];
    else if (a === '--slug' && argv[i + 1]) {
      opts.slugs = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    } else if (a === '--out' && argv[i + 1]) opts.out = resolve(process.cwd(), argv[++i]);
    else if (a === '--max-per-slug' && argv[i + 1]) opts.maxPerSlug = Number(argv[++i]);
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: TEST_STAFF_PASSWORD=... node scripts/discover-load-test-targets.mjs [options]

Options:
  --base URL           Default http://localhost:3000
  --email EMAIL        Staff email
  --password PASS      Staff password (or TEST_STAFF_PASSWORD)
  --slug a,b,c         Restaurant slug(s)
  --out PATH           Output JSON path
  --max-per-slug N     Cap open tables per restaurant (default 200)
`);
      process.exit(0);
    }
  }
  if (!opts.password) {
    console.error('Set TEST_STAFF_PASSWORD or pass --password');
    process.exit(1);
  }
  return opts;
}

async function login(base, email, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(`login failed HTTP ${res.status} ${json.error || ''}`.trim());
  }
  const cookie = res.headers.getSetCookie?.() || [];
  const jar = cookie.map((c) => c.split(';')[0]).join('; ');
  if (!jar) throw new Error('login ok but no session cookie');
  return jar;
}

async function fetchJson(url, cookie) {
  const res = await fetch(url, { headers: { Cookie: cookie } });
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function discoverSlug(base, cookie, slug, maxPerSlug) {
  const boardUrl = `${base}/api/restaurants/${slug}/staff/waiter/board`;
  const { res: boardRes, json: board } = await fetchJson(boardUrl, cookie);
  if (!boardRes.ok || !board) {
    throw new Error(`${slug}: board HTTP ${boardRes.status}`);
  }

  const menuUrl = `${base}/api/dashboard/menu/items`;
  const { res: menuRes, json: menuJson } = await fetchJson(menuUrl, cookie);
  let menuItemId = '';
  if (menuRes.ok && menuJson) {
    const rows = Array.isArray(menuJson) ? menuJson : menuJson.items || [];
    const pick = rows.find((r) => r.available !== false && r.id);
    menuItemId = pick?.id || '';
  }

  const meta = board.sessionMetaByTableId || {};
  const openTables = Object.entries(meta)
    .filter(([, m]) => m?.status === 'open')
    .map(([tableId, m]) => ({
      slug,
      table_id: tableId,
      display_name: m.display_name || tableId.slice(0, 8),
      menu_item_id: menuItemId,
    }))
    .filter((t) => t.menu_item_id)
    .slice(0, maxPerSlug);

  return { openCount: Object.keys(meta).length, targets: openTables, menuItemId };
}

async function main() {
  const opts = parseArgs(process.argv);
  console.log(`BASE=${opts.base} slugs=${opts.slugs.join(',')}`);

  const cookie = await login(opts.base, opts.email, opts.password);
  const allTargets = [];
  const perSlug = {};

  for (const slug of opts.slugs) {
    try {
      const { openCount, targets, menuItemId } = await discoverSlug(
        opts.base,
        cookie,
        slug,
        opts.maxPerSlug,
      );
      perSlug[slug] = { open_sessions: openCount, usable: targets.length, menu_item_id: menuItemId };
      allTargets.push(...targets);
      console.log(`${slug}: ${targets.length} open tables (menu_item=${menuItemId || 'MISSING'})`);
    } catch (e) {
      console.error(`${slug}: ${e instanceof Error ? e.message : e}`);
      perSlug[slug] = { error: String(e) };
    }
  }

  const payload = {
    meta: {
      discovered_at: new Date().toISOString(),
      base: opts.base,
      slugs: opts.slugs,
      per_slug: perSlug,
      total_targets: allTargets.length,
    },
    targets: allTargets,
  };

  writeFileSync(opts.out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${allTargets.length} targets → ${opts.out}`);
  if (allTargets.length === 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
