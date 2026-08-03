import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  attachOpenTableDefaultsToPageModel,
  buildWaiterTableDetailBootFromBoard,
  isAuthoritativeIdleWaiterTableBoot,
  parseWaiterTableDetailFetchScope,
  resolveWaiterTableDetailPaintPhase,
} from './waiter-table-detail-scope';
import type { WaiterTablePageModel } from './waiter-table-detail-types';

const T1 = '11111111-1111-4111-8111-111111111111';

describe('waiter-table-detail-scope', () => {
  it('parseWaiterTableDetailFetchScope defaults to full', () => {
    assert.equal(parseWaiterTableDetailFetchScope(null), 'full');
    assert.equal(parseWaiterTableDetailFetchScope('live'), 'live');
    assert.equal(parseWaiterTableDetailFetchScope('other'), 'full');
  });

  it('resolveWaiterTableDetailPaintPhase is the sole paint gate', () => {
    assert.equal(
      resolveWaiterTableDetailPaintPhase({
        isDemo: true,
        detailLoaded: false,
        needsEntryPull: true,
        entryPullCompleted: false,
      }),
      'ready',
    );
    assert.equal(
      resolveWaiterTableDetailPaintPhase({
        isDemo: false,
        detailLoaded: false,
        needsEntryPull: true,
        entryPullCompleted: false,
      }),
      'cold',
    );
    assert.equal(
      resolveWaiterTableDetailPaintPhase({
        isDemo: false,
        detailLoaded: true,
        needsEntryPull: true,
        entryPullCompleted: false,
      }),
      'chrome',
    );
    assert.equal(
      resolveWaiterTableDetailPaintPhase({
        isDemo: false,
        detailLoaded: true,
        needsEntryPull: true,
        entryPullCompleted: true,
      }),
      'ready',
    );
    assert.equal(
      resolveWaiterTableDetailPaintPhase({
        isDemo: false,
        detailLoaded: true,
        needsEntryPull: false,
        entryPullCompleted: false,
      }),
      'ready',
    );
    assert.equal(
      resolveWaiterTableDetailPaintPhase({
        isDemo: false,
        detailLoaded: false,
        needsEntryPull: false,
        entryPullCompleted: false,
      }),
      'cold',
    );
  });

  it('attachOpenTableDefaultsToPageModel fills empty buffets only', () => {
    const live: WaiterTablePageModel = {
      detail: {
        table: { id: T1, display_name: '1', sort_order: 0, seat_min: 1, seat_max: 4 },
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

  it('buildWaiterTableDetailBootFromBoard idle + occupied chrome stub', () => {
    const board = {
      tables: [{ id: T1, display_name: '1', sort_order: 0, seat_min: 1, seat_max: 4 }],
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
      checkoutRequestedTableIds: [] as string[],
      checkoutRequestedAtByTableId: {} as Record<string, string>,
    };
    const idle = buildWaiterTableDetailBootFromBoard(board, T1);
    assert.ok(idle);
    assert.equal(idle?.detail.table?.id, T1);
    assert.equal(idle?.detail.sessionMeta, null);
    assert.equal(isAuthoritativeIdleWaiterTableBoot(idle), true);

    const occupied = buildWaiterTableDetailBootFromBoard(
      {
        ...board,
        sessionMetaByTableId: {
          [T1]: { sessionId: 's1', openedAt: '2026-01-01T00:00:00Z', status: 'open' },
        },
        checkoutRequestedTableIds: [T1],
        checkoutRequestedAtByTableId: { [T1]: '2026-01-01T01:00:00Z' },
      },
      T1,
    );
    assert.ok(occupied);
    assert.equal(occupied?.detail.sessionMeta?.sessionId, 's1');
    assert.equal(occupied?.detail.orders.length, 0);
    assert.equal(occupied?.detail.checkoutRequested, true);
    assert.equal(occupied?.detail.checkoutRequestedAt, '2026-01-01T01:00:00Z');
    assert.equal(occupied?.buffets[0]?.id, 'b1');
    assert.equal(isAuthoritativeIdleWaiterTableBoot(occupied), false);
  });

  it('occupied chrome stub works without open-table defaults', () => {
    const occupied = buildWaiterTableDetailBootFromBoard(
      {
        tables: [{ id: T1, display_name: '1', sort_order: 0, seat_min: 1, seat_max: 4 }],
        sessionMetaByTableId: {
          [T1]: { sessionId: 's1', openedAt: '2026-01-01T00:00:00Z', status: 'open' },
        },
        openTableDefaults: null,
        partyMembers: [],
        checkoutRequestedTableIds: [],
        checkoutRequestedAtByTableId: {},
      },
      T1,
    );
    assert.ok(occupied);
    assert.equal(occupied?.buffets.length, 0);
    assert.equal(occupied?.detail.sessionMeta?.sessionId, 's1');
  });
});
