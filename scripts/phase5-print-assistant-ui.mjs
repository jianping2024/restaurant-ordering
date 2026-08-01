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
  const upper = read(
    'apps/web/src/components/dashboard/print-assistant/PrintAssistantUpperSection.tsx',
  );
  const queue = read('apps/web/src/components/dashboard/PrintJobsQueuePanel.tsx');
  const recentApi = read('apps/web/src/app/api/print-agent/print-jobs/recent/route.ts');
  const recentLib = read('apps/web/src/lib/print-jobs-recent.ts');
  const devices = read('apps/web/src/components/dashboard/PrintAgentDevicesPanel.tsx');
  const features = read('apps/web/src/components/dashboard/FeatureFlagsManager.tsx');
  const abnormal = read('apps/web/src/components/dashboard/AbnormalOperationsManager.tsx');
  const messages = read('apps/web/src/lib/i18n/messages.ts');

  assertContains('upper mounts PrintJobsQueuePanel', upper, /PrintJobsQueuePanel/, pass);
  assertContains('upper places queue after devices', upper, /PrintAgentDevicesPanel[\s\S]*PrintJobsQueuePanel[\s\S]*PrintAgentPairingPanel/, pass);
  assertContains('queue uses shared recent limit', queue, /PRINT_JOBS_RECENT_LIMIT/, pass);
  assertContains('recent API uses shared query', recentApi, /queryRecentPrintJobs/, pass);
  assertContains('shared recent limit is 5', recentLib, /PRINT_JOBS_RECENT_LIMIT = 5/, pass);
  assertNotContains('no paging i18n prevPage', messages, /prevPage:/, pass);
  assertNotContains('no paging i18n statusAll', messages, /statusAll:/, pass);
  assertContains('devices revoke filters locally', devices, /setDevices\(\(prev\) => prev\.filter/, pass);
  assertNotContains('devices revoke skips full refresh', devices, /await refresh\(\)/, pass);
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
