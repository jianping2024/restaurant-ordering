import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultPrintAgentCloudConfig, parseDefaultReceiptStationId } from './print-agent-config';

describe('defaultPrintAgentCloudConfig', () => {
  it('uses 20s idle poll interval by default', () => {
    const config = defaultPrintAgentCloudConfig();
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
