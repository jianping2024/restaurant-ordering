import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  printNotifyModeClass,
  resolvePrimaryOnlineDeviceNotifyMode,
  type PrintAgentDeviceHeartbeatRow,
} from '@/lib/print-agent-heartbeat';

function device(
  partial: Partial<PrintAgentDeviceHeartbeatRow> & Pick<PrintAgentDeviceHeartbeatRow, 'id'>,
): PrintAgentDeviceHeartbeatRow {
  return {
    label: null,
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    last_seen: new Date().toISOString(),
    ...partial,
  };
}

describe('resolvePrimaryOnlineDeviceNotifyMode', () => {
  const now = Date.now();

  it('returns null when no online devices', () => {
    assert.equal(
      resolvePrimaryOnlineDeviceNotifyMode(
        [device({ id: 'a', last_seen: new Date(now - 20 * 60 * 1000).toISOString(), notification_mode: 'polling' })],
        now,
      ),
      null,
    );
  });

  it('uses the first online device mode (same as device card row)', () => {
    assert.equal(
      resolvePrimaryOnlineDeviceNotifyMode(
        [
          device({ id: 'a', notification_mode: 'realtime' }),
          device({ id: 'b', notification_mode: 'polling' }),
        ],
        now,
      ),
      'realtime',
    );
  });

  it('returns realtime when the online device reports realtime', () => {
    assert.equal(
      resolvePrimaryOnlineDeviceNotifyMode([device({ id: 'a', notification_mode: 'realtime' })], now),
      'realtime',
    );
  });

  it('returns polling when the online device reports polling', () => {
    assert.equal(
      resolvePrimaryOnlineDeviceNotifyMode([device({ id: 'a', notification_mode: 'polling' })], now),
      'polling',
    );
  });
});

describe('printNotifyModeClass', () => {
  it('uses danger tone only for polling', () => {
    assert.match(printNotifyModeClass('polling'), /status-danger/);
    assert.doesNotMatch(printNotifyModeClass('realtime'), /status-danger/);
  });
});
