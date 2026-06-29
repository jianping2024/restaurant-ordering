import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Order } from '@/types';
import { buildBuffetBaseLine } from '@/lib/buffet-order';
import {
  guestOrderGateFromCachedState,
  guestOrderGateFromSessionContext,
  guestOrderingActionHint,
} from '@/lib/customer-menu-order-gate';

const buffetLine = buildBuffetBaseLine({
  buffet: { id: 'buffet-a', name: 'Lunch' },
  adultCount: 2,
  childCount: 0,
  resolved: { adult_price: 20, child_price: 10, rule_id: 'r1', time_slot_id: 's1' },
});
assert.ok(buffetLine);

const openOrders = [
  {
    id: 'o1',
    status: 'done',
    items: [buffetLine],
    created_at: '',
    updated_at: '',
    restaurant_id: 'r1',
    session_id: 's1',
    table_id: 't1',
    display_name: 'A1',
    total_amount: 40,
  } satisfies Order,
];

describe('guestOrderGateFromSessionContext', () => {
  it('blocks billing session without buffet', () => {
    const gate = guestOrderGateFromSessionContext({
      table_id: 't1',
      display_name: 'A1',
      active_session: { id: 's1', status: 'billing' } as never,
      recent_orders: [],
    });
    assert.equal(gate.canPlace, false);
    assert.equal(gate.sessionStatus, 'billing');
  });

  it('allows open session with buffet_base line', () => {
    const gate = guestOrderGateFromSessionContext({
      table_id: 't1',
      display_name: 'A1',
      active_session: { id: 's1', status: 'open' } as never,
      recent_orders: openOrders,
    });
    assert.equal(gate.canPlace, true);
    assert.equal(gate.sessionStatus, 'open');
  });
});

describe('guestOrderGateFromCachedState', () => {
  it('returns null when refresh is needed', () => {
    assert.equal(
      guestOrderGateFromCachedState(false, { status: 'billing' }, []),
      null,
    );
  });

  it('short-circuits demo', () => {
    assert.deepEqual(guestOrderGateFromCachedState(true, null, []), {
      canPlace: true,
      sessionStatus: null,
    });
  });
});

describe('guestOrderingActionHint', () => {
  it('maps billing to bill disabled copy', () => {
    assert.match(guestOrderingActionHint('zh', 'billing'), /结账/);
  });
});
