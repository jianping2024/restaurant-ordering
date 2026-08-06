import assert from 'node:assert/strict';
import test from 'node:test';
import { printAssistantPanelShell } from './print-assistant-ui';

test('print assistant panels share one card shell token', () => {
  assert.match(printAssistantPanelShell, /bg-brand-card/);
  assert.doesNotMatch(printAssistantPanelShell, /bg-white/);
});

test('print assistant panels import the shared shell (no duplicate inline shell)', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const dashboard = join(dirname(fileURLToPath(import.meta.url)), '..');
  const files = [
    'PrintAgentDevicesPanel.tsx',
    'PrintJobsQueuePanel.tsx',
    'PrintAgentPairingPanel.tsx',
    'PrintAgentDownloadPanel.tsx',
    'PrintAgentSchedulePanel.tsx',
  ];
  for (const file of files) {
    const src = await readFile(join(dashboard, file), 'utf8');
    assert.match(src, /printAssistantPanelShell/, `${file} must use printAssistantPanelShell`);
    assert.doesNotMatch(
      src,
      /rounded-2xl border border-brand-border bg-brand-card p-4 sm:p-5/,
      `${file} must not duplicate inline shell`,
    );
  }
});
