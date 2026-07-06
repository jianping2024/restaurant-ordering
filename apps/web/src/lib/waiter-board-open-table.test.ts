import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildIdleOpenTablePageModel,
  reconcileOpenTablePageModel,
} from './waiter-board-open-table.ts';
import type { WaiterTablePageModel } from './waiter-table-detail-types.ts';

const TABLE = {
  id: '00000000-0000-4000-8000-000000000011',
  display_name: '011',
  sort_order: 11,
  seat_min: 2,
  seat_max: 4,
};

const DEFAULTS = {
  buffets: [
    {
      id: 'buffet-1',
      restaurant_id: 'r1',
      name: 'Buffet livre',
      is_active: true,
      description: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  buffetPricesByBuffetId: {
    'buffet-1': {
      adult_price: 19.95,
      child_price: 10,
      rule_id: 'rule-1',
      time_slot_id: 'slot-1',
    },
  },
};

describe('buildIdleOpenTablePageModel', () => {
  it('builds an idle page model with empty orders and no session', () => {
    const model = buildIdleOpenTablePageModel(DEFAULTS, TABLE);
    assert.equal(model.detail.table?.id, TABLE.id);
    assert.equal(model.detail.sessionMeta, null);
    assert.deepEqual(model.detail.orders, []);
    assert.equal(model.buffets.length, 1);
    assert.equal(model.buffetPricesByBuffetId['buffet-1']?.adult_price, 19.95);
  });
});

describe('reconcileOpenTablePageModel', () => {
  it('confirms idle when authoritative model has no session', () => {
    const idle = buildIdleOpenTablePageModel(DEFAULTS, TABLE);
    assert.deepEqual(reconcileOpenTablePageModel(idle), {
      kind: 'confirmed_idle',
      model: idle,
    });
  });

  it('flags stale occupied when authoritative model has a session', () => {
    const occupied: WaiterTablePageModel = {
      ...buildIdleOpenTablePageModel(DEFAULTS, TABLE),
      detail: {
        table: TABLE,
        sessionMeta: {
          sessionId: 'sess-1',
          openedAt: '2026-01-01T10:00:00.000Z',
          status: 'open',
        },
        orders: [],
        checkoutRequested: false,
        checkoutRequestedAt: null,
      },
    };
    assert.equal(reconcileOpenTablePageModel(occupied).kind, 'stale_occupied');
  });

  it('returns unavailable when authoritative model has no table', () => {
    const missingTable: WaiterTablePageModel = {
      detail: {
        table: null,
        sessionMeta: null,
        orders: [],
        checkoutRequested: false,
        checkoutRequestedAt: null,
      },
      buffets: [],
      buffetPricesByBuffetId: {},
    };
    assert.equal(reconcileOpenTablePageModel(missingTable).kind, 'unavailable');
  });
});
