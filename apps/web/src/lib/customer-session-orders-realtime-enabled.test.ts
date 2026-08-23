import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { customerSessionOrdersRealtimeEnabled } from './customer-session-orders-realtime-enabled';

describe('customerSessionOrdersRealtimeEnabled', () => {
  it('enables for resolved open guest session', () => {
    assert.equal(
      customerSessionOrdersRealtimeEnabled({
        sessionResolved: true,
        sessionStatus: 'open',
        sessionId: 'sess-1',
        staffAssisted: null,
      }),
      true,
    );
  });

  it('disables for demo, staff-assisted, billing, or unresolved', () => {
    const base = {
      sessionResolved: true,
      sessionStatus: 'open' as const,
      sessionId: 'sess-1',
      staffAssisted: null,
    };
    assert.equal(customerSessionOrdersRealtimeEnabled({ ...base, isDemo: true }), false);
    assert.equal(
      customerSessionOrdersRealtimeEnabled({ ...base, staffAssisted: { kind: 'waiter' } }),
      false,
    );
    assert.equal(
      customerSessionOrdersRealtimeEnabled({ ...base, sessionStatus: 'billing' }),
      false,
    );
    assert.equal(customerSessionOrdersRealtimeEnabled({ ...base, sessionResolved: false }), false);
    assert.equal(customerSessionOrdersRealtimeEnabled({ ...base, sessionId: null }), false);
  });
});
