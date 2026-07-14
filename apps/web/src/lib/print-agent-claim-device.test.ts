import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildClaimDeviceRow,
  classifyClaimDevice,
  type ClaimDeviceRowInput,
} from './print-agent-claim-device';

const DEVICE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RESTAURANT_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RESTAURANT_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PAIRING_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const baseInput: ClaimDeviceRowInput = {
  deviceId: DEVICE_ID,
  restaurantId: RESTAURANT_B,
  pairingId: PAIRING_ID,
  label: '收银台1',
  validUntil: '2026-12-31T00:00:00.000Z',
  lastSeen: '2026-07-14T12:00:00.000Z',
};

describe('classifyClaimDevice', () => {
  it('returns created when device row is missing', () => {
    assert.equal(classifyClaimDevice(null, RESTAURANT_A), 'created');
  });

  it('returns re_paired for the same restaurant', () => {
    assert.equal(
      classifyClaimDevice({ id: DEVICE_ID, restaurant_id: RESTAURANT_A }, RESTAURANT_A),
      're_paired',
    );
  });

  it('returns transferred when restaurant changes', () => {
    assert.equal(
      classifyClaimDevice({ id: DEVICE_ID, restaurant_id: RESTAURANT_A }, RESTAURANT_B),
      'transferred',
    );
  });
});

describe('buildClaimDeviceRow', () => {
  it('keeps restaurant-scoped telemetry on re-pair', () => {
    const row = buildClaimDeviceRow(baseInput, 're_paired');
    assert.equal(row.restaurant_id, RESTAURANT_B);
    assert.equal(row.routing_snapshot, undefined);
  });

  it('clears restaurant-scoped telemetry on transfer', () => {
    const row = buildClaimDeviceRow(baseInput, 'transferred');
    assert.equal(row.routing_snapshot, null);
    assert.equal(row.mapped_station_count, null);
    assert.equal(row.last_print_at, null);
    assert.equal(row.last_print_status, null);
    assert.equal(row.schedule_open, null);
  });
});
