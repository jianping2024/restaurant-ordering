import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  attachOpenTableDefaultsToPageModel,
  buildWaiterTableDetailBootFromBoard,
  parseWaiterTableDetailFetchScope,
} from './waiter-table-detail-scope';
import type { WaiterTablePageModel } from './waiter-table-detail-types';

describe('waiter-table-detail-scope', () => {
  it('parseWaiterTableDetailFetchScope defaults to full', () => {
    assert.equal(parseWaiterTableDetailFetchScope(null), 'full');
    assert.equal(parseWaiterTableDetailFetchScope('live'), 'live');
    assert.equal(parseWaiterTableDetailFetchScope('other'), 'full');
  });

  it('attachOpenTableDefaultsToPageModel fills empty buffets only', () => {
    const live: WaiterTablePageModel = {
      detail: {
        table: { id: 't1', display_name: '1', sort_order: 0, seat_min: 1, seat_max: 4 },
        sessionMeta: null,
        orders: [],
        checkoutRequested: false,
        checkoutRequestedAt: null,
      },
      buffets: [],
      buffetPricesByBuffetId: {},
      inTableParty: false,
    };
    const defaults = {
      buffets: [
        {
          id: 'b1',
          restaurant_id: 'r1',
          name: 'Lunch',
          is_active: true,
          description: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
      buffetPricesByBuffetId: { b1: null },
    };
    const next = attachOpenTableDefaultsToPageModel(live, defaults);
    assert.equal(next.buffets.length, 1);
    assert.equal(next.buffets[0]?.id, 'b1');

    const already = attachOpenTableDefaultsToPageModel(
      { ...live, buffets: defaults.buffets, buffetPricesByBuffetId: { b1: null } },
      { buffets: [], buffetPricesByBuffetId: {} },
    );
    assert.equal(already.buffets.length, 1);
  });

  it('buildWaiterTableDetailBootFromBoard only for idle tables with defaults', () => {
    const board = {
      tables: [{ id: 't1', display_name: '1', sort_order: 0, seat_min: 1, seat_max: 4 }],
      sessionMetaByTableId: {} as Record<string, never>,
      openTableDefaults: {
        buffets: [
          {
            id: 'b1',
            restaurant_id: 'r1',
            name: 'Lunch',
            is_active: true,
            description: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        buffetPricesByBuffetId: { b1: null },
      },
      partyMembers: [] as [],
    };
    const idle = buildWaiterTableDetailBootFromBoard(board, 't1');
    assert.ok(idle);
    assert.equal(idle?.detail.table?.id, 't1');
    assert.equal(idle?.detail.sessionMeta, null);

    const occupied = buildWaiterTableDetailBootFromBoard(
      {
        ...board,
        sessionMetaByTableId: {
          t1: { sessionId: 's1', openedAt: '2026-01-01T00:00:00Z', status: 'open' },
        },
      },
      't1',
    );
    assert.equal(occupied, null);
  });
});
