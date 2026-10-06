import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { customerTableSessionRealtimeEnabled } from './customer-table-session-realtime-enabled';

describe('customerTableSessionRealtimeEnabled', () => {
  it('enables for resolved guest table even before session opens', () => {
    assert.equal(
      customerTableSessionRealtimeEnabled({
        sessionResolved: true,
        tableId: 'table-1',
        staffAssisted: null,
      }),
      true,
    );
  });

  it('disables for demo, staff-assisted, unresolved, or missing table', () => {
    const base = {
      sessionResolved: true,
      tableId: 'table-1',
      staffAssisted: null as unknown,
    };
    assert.equal(customerTableSessionRealtimeEnabled({ ...base, isDemo: true }), false);
    assert.equal(
      customerTableSessionRealtimeEnabled({ ...base, staffAssisted: { kind: 'waiter' } }),
      false,
    );
    assert.equal(
      customerTableSessionRealtimeEnabled({ ...base, sessionResolved: false }),
      false,
    );
    assert.equal(customerTableSessionRealtimeEnabled({ ...base, tableId: null }), false);
    assert.equal(customerTableSessionRealtimeEnabled({ ...base, tableId: '' }), false);
  });
});
