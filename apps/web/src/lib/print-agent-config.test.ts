import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cloudConfigToForm,
  defaultPrintAgentCloudConfig,
  formToCloudConfig,
  isStationSlipShowCategoryGroupEnabled,
  normalizePrintAgentCloudConfig,
  parseDefaultReceiptStationId,
  PRINT_AGENT_POLL_LIMITS,
  sanitizePollConfig,
} from './print-agent-config';

const L = PRINT_AGENT_POLL_LIMITS;

describe('defaultPrintAgentCloudConfig', () => {
  it('uses poll defaults within configured minimums', () => {
    const poll = defaultPrintAgentCloudConfig().poll!;
    assert.equal(poll.after_print_interval_sec, L.afterPrintIntervalSec.default);
    assert.equal(poll.warm_interval_sec, L.warmIntervalSec.default);
    assert.equal(poll.idle_interval_sec, L.idleIntervalSec.default);
    assert.equal(poll.warm_after_activity_sec, L.warmAfterActivitySec.default);
    assert.ok(poll.after_print_interval_sec! >= L.afterPrintIntervalSec.min);
    assert.ok(poll.warm_interval_sec! >= L.warmIntervalSec.min);
    assert.ok(poll.idle_interval_sec! >= L.idleIntervalSec.min);
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
    assert.equal(poll.after_print_interval_sec, L.afterPrintIntervalSec.min);
    assert.equal(poll.warm_interval_sec, L.warmIntervalSec.min);
    assert.equal(poll.warm_after_activity_sec, L.warmAfterActivitySec.min);
    assert.equal(poll.idle_interval_sec, L.idleIntervalSec.min);
  });

  it('keeps values at the configured minimum', () => {
    const poll = sanitizePollConfig({
      after_print_interval_sec: L.afterPrintIntervalSec.min,
      warm_interval_sec: L.warmIntervalSec.min,
      idle_interval_sec: L.idleIntervalSec.min,
    });
    assert.equal(poll.after_print_interval_sec, L.afterPrintIntervalSec.min);
    assert.equal(poll.warm_interval_sec, L.warmIntervalSec.min);
    assert.equal(poll.idle_interval_sec, L.idleIntervalSec.min);
  });

  it('caps values above maximum', () => {
    const poll = sanitizePollConfig({
      after_print_interval_sec: 999,
      warm_interval_sec: 999,
      warm_after_activity_sec: 99999,
      idle_interval_sec: 999,
    });
    assert.equal(poll.after_print_interval_sec, L.afterPrintIntervalSec.max);
    assert.equal(poll.warm_interval_sec, L.warmIntervalSec.max);
    assert.equal(poll.warm_after_activity_sec, L.warmAfterActivitySec.max);
    assert.equal(poll.idle_interval_sec, L.idleIntervalSec.max);
  });
});

describe('normalizePrintAgentCloudConfig', () => {
  it('sanitizes stored poll values on read', () => {
    const config = normalizePrintAgentCloudConfig({
      poll: {
        after_print_interval_sec: 4,
        warm_interval_sec: 4,
        warm_after_activity_sec: 300,
        idle_interval_sec: 4,
      },
    });
    assert.equal(config.poll?.after_print_interval_sec, L.afterPrintIntervalSec.min);
    assert.equal(config.poll?.warm_interval_sec, L.warmIntervalSec.min);
    assert.equal(config.poll?.warm_after_activity_sec, L.warmAfterActivitySec.min);
    assert.equal(config.poll?.idle_interval_sec, L.idleIntervalSec.min);
  });

  it('preserves in-range poll values including former dashboard floor values', () => {
    const config = normalizePrintAgentCloudConfig({
      poll: {
        after_print_interval_sec: 5,
        warm_interval_sec: 9,
        warm_after_activity_sec: 1800,
        idle_interval_sec: 10,
      },
    });
    assert.equal(config.poll?.after_print_interval_sec, 5);
    assert.equal(config.poll?.warm_interval_sec, 9);
    assert.equal(config.poll?.warm_after_activity_sec, 1800);
    assert.equal(config.poll?.idle_interval_sec, 10);
  });

  it('reads station slip category group toggle', () => {
    assert.equal(
      isStationSlipShowCategoryGroupEnabled({ station_slip_show_category_group: true }),
      true,
    );
    assert.equal(isStationSlipShowCategoryGroupEnabled({}), false);
  });
});

describe('formToCloudConfig', () => {
  it('sanitizes poll fields when saving', () => {
    const form = cloudConfigToForm({});
    form.afterPrintIntervalSec = 4;
    form.warmIntervalSec = 3;
    form.warmAfterActivitySec = 500;
    form.idleIntervalSec = 2;
    const config = formToCloudConfig(form);
    assert.equal(config.poll?.after_print_interval_sec, L.afterPrintIntervalSec.min);
    assert.equal(config.poll?.warm_interval_sec, L.warmIntervalSec.min);
    assert.equal(config.poll?.warm_after_activity_sec, L.warmAfterActivitySec.min);
    assert.equal(config.poll?.idle_interval_sec, L.idleIntervalSec.min);
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
