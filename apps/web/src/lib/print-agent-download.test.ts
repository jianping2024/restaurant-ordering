import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getPrintAgentVersion } from '@/lib/print-agent-download';

test('getPrintAgentVersion returns semver from VERSION file', () => {
  const version = getPrintAgentVersion();
  assert.match(version, /^\d+\.\d+\.\d+$/);
});
