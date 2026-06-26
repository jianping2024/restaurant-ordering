/**
 * P5 UI wiring checks for abnormal operations page.
 * Usage: node scripts/phase5-abnormal-operations-ui.mjs
 */
import { readFileSync } from 'fs';

const ROOT = new URL('..', import.meta.url).pathname;

function read(rel) {
  return readFileSync(`${ROOT}/${rel}`, 'utf8');
}

function assertContains(name, text, pattern, pass) {
  pass.push({ check: name, pass: pattern.test(text) });
}

function main() {
  const pass = [];
  const nav = read('apps/web/src/components/dashboard/DashboardNav.tsx');
  const page = read('apps/web/src/app/dashboard/abnormal-operations/page.tsx');
  const mgr = read('apps/web/src/components/dashboard/AbnormalOperationsManager.tsx');
  const messages = read('apps/web/src/lib/i18n/messages.ts');
  const getRoute = read('apps/web/src/app/api/dashboard/abnormal-operations/route.ts');
  const patchRoute = read('apps/web/src/app/api/dashboard/abnormal-operations/[id]/route.ts');

  assertContains('owner nav abnormal-operations', nav, /\/dashboard\/abnormal-operations/, pass);
  assertContains('owner nav key abnormalOps', nav, /abnormalOps/, pass);
  assertContains('page owner only notFound', page, /notFound\(\)/, pass);
  assertContains('manager fetch list', mgr, /fetchAbnormalOperationsList|client-api/, pass);
  assertContains('manager filters debounce', mgr, /500|debounc/i, pass);
  assertContains('manager refresh cooldown', mgr, /60|cooldown/i, pass);
  assertContains('manager detail modal', mgr, /ConfirmModal|modal|detail/i, pass);
  assertContains('manager confirm ignore', mgr, /CONFIRMED|IGNORED/, pass);
  assertContains('manager closes detail after patch', mgr, /closeDetail\(\)/, pass);
  assertContains('i18n abnormalOps zh', messages, /abnormalOps:/, pass);
  assertContains('GET route owner context', getRoute, /loadOwnerAbnormalOperationsContext/, pass);
  assertContains('GET route rate limit', getRoute, /abnormalOperationsListRateLimitCheck/, pass);
  assertContains('PATCH route audit service', patchRoute, /patchAbnormalOperationWithAudit/, pass);

  const summary = {
    phase: 5,
    scope: 'UI + API route wiring (static)',
    checks: pass,
    all_pass: pass.every((c) => c.pass),
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.all_pass ? 0 : 1);
}

main();
