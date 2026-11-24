#!/usr/bin/env node
/**
 * Store-id source check (multi-store plan §6.2) — supplement to the branded type
 * `AuthorizedRestaurantId`, which is the primary (compile-time) enforcement.
 *
 * 1. `mintAuthorizedRestaurantId(` may only appear in its own module, in
 *    `lib/staff-gate-db.ts` (`resolvePrincipalForRestaurantWith`, the body of
 *    `loadPrincipalForRestaurant`) and in `lib/permissions/restaurant-access.ts`
 *    (`listAuthorizedRestaurantIdsWithPermission`, the batch entry for the multi-store
 *    overview — same admission rule, one membership→role join; plan §6.2b).
 * 2. Store-gated routes (any `app/api/restaurants/[slug]/**` route that calls
 *    `requireStoreRestaurantId`):
 *    - the slug-resolved `storeId` may only feed the auth gate / context loaders;
 *    - `.eq('restaurant_id', X)` and `restaurant_id: X` must use the gate's id
 *      (`*.restaurantId` from ctx/auth/loaded, or a local `restaurantId`), never the
 *      URL id, a query row (`*.restaurant.id`), `principal.restaurantId`, body or params.
 *
 * Exit 1 with file:line list on violation. Run by `gate.sh check`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const webSrc = join(root, 'apps/web/src');
const MINT_ALLOWED = new Set([
  'apps/web/src/lib/permissions/authorized-restaurant-id.ts',
  'apps/web/src/lib/staff-gate-db.ts',
  'apps/web/src/lib/permissions/restaurant-access.ts',
]);
const PUBLIC_MINT_ALLOWED = new Set([
  'apps/web/src/lib/permissions/authorized-restaurant-id.ts',
  'apps/web/src/lib/customer-restaurant-gate.ts',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.next')) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const violations = [];
const report = (file, line, msg) => violations.push(`${relative(root, file)}:${line}: ${msg}`);

const STORE_ID_ALLOWED_USE =
  /requireStoreRestaurantId\(|storeId instanceof NextResponse|return storeId;|\b(require[A-Z]\w*|load[A-Z]\w*|getDashboard\w*|get[A-Z]\w*Context)\(\s*(?:[^()]*,\s*)?storeId\b|\b\w+Actor\(storeId\b|^\s*storeId[,)]|storeId: string/;
const BAD_STORE_SOURCE =
  /\bstoreId\b|\brestaurant\.id\b|principal\.restaurantId|\bbody\b|\bparams\b|searchParams|\bquery\b|\brow\b|\bdata\b/;

for (const file of walk(webSrc)) {
  const rel = relative(root, file);
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  if (!MINT_ALLOWED.has(rel)) {
    lines.forEach((l, i) => {
      if (/mintAuthorizedRestaurantId\s*\(/.test(l)) {
        report(file, i + 1, 'mintAuthorizedRestaurantId outside the sole auth entry');
      }
    });
  }
  if (!PUBLIC_MINT_ALLOWED.has(rel)) {
    lines.forEach((l, i) => {
      if (/mintPublicRestaurantId\s*\(/.test(l)) {
        report(file, i + 1, 'mintPublicRestaurantId outside the sole public slug gate');
      }
    });
  }

  const isStoreRoute =
    rel.startsWith('apps/web/src/app/api/restaurants/[slug]/') &&
    rel.endsWith('/route.ts') &&
    text.includes('requireStoreRestaurantId(');
  if (!isStoreRoute) continue;

  lines.forEach((l, i) => {
    if (/\bstoreId\b/.test(l) && !STORE_ID_ALLOWED_USE.test(l)) {
      report(file, i + 1, 'URL store id (storeId) used beyond the auth gate');
    }
    const m = l.match(/(?:\.eq\(\s*'restaurant_id'\s*,|\brestaurant_id:)\s*([^,)\n}]+)/);
    if (m && BAD_STORE_SOURCE.test(m[1])) {
      report(file, i + 1, `restaurant_id from non-gate source: ${m[1].trim()}`);
    }
  });
}

if (violations.length) {
  console.error('店 id 来源检查失败（multi-store plan §6.2）：');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log('店 id 来源检查通过');
