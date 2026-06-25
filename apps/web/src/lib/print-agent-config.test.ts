import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultPrintAgentCloudConfig } from './print-agent-config';

describe('defaultPrintAgentCloudConfig', () => {
  it('uses 20s idle poll interval by default', () => {
    const config = defaultPrintAgentCloudConfig();
    assert.equal(config.poll?.idle_interval_sec, 20);
  });
});
