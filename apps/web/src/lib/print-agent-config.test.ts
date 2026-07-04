import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cloudConfigToForm,
  defaultPrintAgentCloudConfig,
  formToCloudConfig,
  normalizePrintAgentCloudConfig,
  parseDefaultReceiptStationId,
  PRINT_AGENT_POLL_LIMITS,
  sanitizePollConfig,
} from './print-agent-config';

describe('defaultPrintAgentCloudConfig', () => {
  it('uses poll defaults within configured minimums', () => {
    const config = defaultPrintAgentCloudConfig();
    const poll = config.poll!;
    assert.equal(poll.idle_interval_sec, PRINT_AGENT_POLL_LIMITS.idleIntervalSec.default);
    assert.equal(poll.after_print_interval_sec, PRINT_AGENT_POLL_LIMITS.afterPrintIntervalSec.default);
    assert.equal(poll.warm_interval_sec, PRINT_AGENT_POLL_LIMITS.warmIntervalSec.default);
    assert.equal(poll.warm_after_activity_sec, PRINT_AGENT_POLL_LIMITS.warmAfterActivitySec.default);
  });
});

describe('sanitizePollConfig', () => {
  it('raises values below minimum', () => {
    const poll = sanitizePollConfig({
      after_print_interval_sec: 0,
      warm_interval_sec: 2,
      warm_after_activity_sec: 60,
      idle_interval_sec: 3,
    });
    assert.equal(poll.after_print_interval_sec, 8);
    assert.equal(poll.warm_interval_sec, 15);
    assert.equal(poll.warm_after_activity_sec, 600);
    assert.equal(poll.idle_interval_sec, 20);
  });

  it('caps values above maximum', () => {
    const poll = sanitizePollConfig({
      after_print_interval_sec: 999,
      warm_interval_sec: 999,
      warm_after_activity_sec: 99999,
      idle_interval_sec: 999,
    });
    assert.equal(poll.after_print_interval_sec, 60);
    assert.equal(poll.warm_interval_sec, 60);
    assert.equal(poll.warm_after_activity_sec, 7200);
    assert.equal(poll.idle_interval_sec, 120);
  });
});

describe('normalizePrintAgentCloudConfig', () => {
  it('sanitizes stored poll values on read', () => {
    const config = normalizePrintAgentCloudConfig({
      poll: {
        after_print_interval_sec: 5,
        warm_interval_sec: 10,
        warm_after_activity_sec: 300,
        idle_interval_sec: 10,
      },
    });
    assert.equal(config.poll?.after_print_interval_sec, 8);
    assert.equal(config.poll?.warm_interval_sec, 15);
    assert.equal(config.poll?.warm_after_activity_sec, 600);
    assert.equal(config.poll?.idle_interval_sec, 20);
  });
});

describe('formToCloudConfig', () => {
  it('sanitizes poll fields when saving', () => {
    const form = cloudConfigToForm({});
    form.afterPrintIntervalSec = 7;
    form.warmIntervalSec = 12;
    form.warmAfterActivitySec = 500;
    form.idleIntervalSec = 18;
    const config = formToCloudConfig(form);
    assert.equal(config.poll?.after_print_interval_sec, 8);
    assert.equal(config.poll?.warm_interval_sec, 15);
    assert.equal(config.poll?.warm_after_activity_sec, 600);
    assert.equal(config.poll?.idle_interval_sec, 20);
  });
});

describe('parseDefaultReceiptStationId', () => {
  it('accepts station-prefixed UUIDs', () => {
    const id = 'station:550e8400-e29b-41d4-a716-446655440000';
    assert.equal(parseDefaultReceiptStationId(id), id);
  });

  it('rejects invalid values', () => {
    assert.equal(parseDefaultReceiptStationId(''), undefined);
    assert.equal(parseDefaultReceiptStationId('cashier'), undefined);
    assert.equal(parseDefaultReceiptStationId('station:not-a-uuid'), undefined);
  });
});
