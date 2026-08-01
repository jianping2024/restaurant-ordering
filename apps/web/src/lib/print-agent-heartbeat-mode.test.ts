import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  printNotifyModeClass,
  resolveRestaurantPrintNotifyMode,
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

describe('resolveRestaurantPrintNotifyMode', () => {
  const now = Date.now();

  it('returns null when no online devices', () => {
    assert.equal(
      resolveRestaurantPrintNotifyMode(
        [device({ id: 'a', last_seen: new Date(now - 20 * 60 * 1000).toISOString(), notification_mode: 'polling' })],
        now,
      ),
      null,
    );
  });

  it('prefers polling when any online device is polling', () => {
    assert.equal(
      resolveRestaurantPrintNotifyMode(
        [
          device({ id: 'a', notification_mode: 'realtime' }),
          device({ id: 'b', notification_mode: 'polling' }),
        ],
        now,
      ),
      'polling',
    );
  });

  it('returns realtime when all online report realtime', () => {
    assert.equal(
      resolveRestaurantPrintNotifyMode([device({ id: 'a', notification_mode: 'realtime' })], now),
      'realtime',
    );
  });
});

describe('printNotifyModeClass', () => {
  it('uses danger tone only for polling', () => {
    assert.match(printNotifyModeClass('polling'), /status-danger/);
    assert.doesNotMatch(printNotifyModeClass('realtime'), /status-danger/);
  });
});
