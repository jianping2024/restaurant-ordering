/**
 * Static wiring checks for print assistant settings + related dashboard patches.
 * Usage: node scripts/phase5-print-assistant-ui.mjs
 */
import { readFileSync } from 'fs';

const ROOT = new URL('..', import.meta.url).pathname;

function read(rel) {
  return readFileSync(`${ROOT}/${rel}`, 'utf8');
}

function assertContains(name, text, pattern, pass) {
  pass.push({ check: name, pass: pattern.test(text) });
}

function assertNotContains(name, text, pattern, pass) {
  pass.push({ check: name, pass: !pattern.test(text) });
}

function main() {
  const pass = [];
  const printPage = read('apps/web/src/app/dashboard/settings/print-assistant/page.tsx');
  const devices = read('apps/web/src/components/dashboard/PrintAgentDevicesPanel.tsx');
  const features = read('apps/web/src/components/dashboard/FeatureFlagsManager.tsx');
  const abnormal = read('apps/web/src/components/dashboard/AbnormalOperationsManager.tsx');

  assertNotContains('print-assistant page omits queue panel', printPage, /PrintJobsQueuePanel/, pass);
  assertNotContains('print-assistant page omits print_jobs query', printPage, /print_jobs/, pass);
  assertContains('devices revoke filters locally', devices, /setDevices\(\(prev\) => prev\.filter/, pass);
  assertNotContains('devices revoke skips full refresh', devices, /await refresh\(\)/, pass);
  assertNotContains('feature flags no router.refresh', features, /router\.refresh/, pass);
  assertContains('feature flags applies PATCH response', features, /json\.flags\) setFlags/, pass);
  assertContains('abnormal ops merges patch locally', abnormal, /mergePatchedAbnormalOperationRow/, pass);
  assertContains('abnormal ops closes modal after patch', abnormal, /closeDetail\(\)/, pass);

  const summary = {
    phase: 5,
    scope: 'print-assistant + dashboard patch UX (static)',
    checks: pass,
    all_pass: pass.every((c) => c.pass),
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.all_pass ? 0 : 1);
}

main();
