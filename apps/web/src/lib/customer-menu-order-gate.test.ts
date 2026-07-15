import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  guestOrderGateFromCachedState,
  guestOrderGateFromSessionContext,
  guestOrderingActionHint,
} from '@/lib/customer-menu-order-gate';

describe('guestOrderGateFromSessionContext', () => {
  it('blocks billing session', () => {
    const gate = guestOrderGateFromSessionContext({
      table_id: 't1',
      display_name: 'A1',
      active_session: { id: 's1', status: 'billing' } as never,
      recent_orders: [],
    });
    assert.equal(gate.canPlace, false);
    assert.equal(gate.sessionStatus, 'billing');
  });

  it('allows open session without buffet lines', () => {
    const gate = guestOrderGateFromSessionContext({
      table_id: 't1',
      display_name: 'A1',
      active_session: { id: 's1', status: 'open' } as never,
      recent_orders: [],
    });
    assert.equal(gate.canPlace, true);
    assert.equal(gate.sessionStatus, 'open');
  });
});

describe('guestOrderGateFromCachedState', () => {
  it('returns null when refresh is needed', () => {
    assert.equal(guestOrderGateFromCachedState(false, { status: 'billing' }), null);
  });

  it('short-circuits demo', () => {
    assert.deepEqual(guestOrderGateFromCachedState(true, null), {
      canPlace: true,
      sessionStatus: null,
    });
  });

  it('returns open gate from cached session', () => {
    assert.deepEqual(guestOrderGateFromCachedState(false, { status: 'open' }), {
      canPlace: true,
      sessionStatus: 'open',
    });
  });
});

describe('guestOrderingActionHint', () => {
  it('maps billing to bill disabled copy', () => {
    assert.match(guestOrderingActionHint('zh', 'billing'), /结账/);
  });
});
