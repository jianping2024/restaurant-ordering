import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatWaiterBoardLaneCountLabel,
  waiterBoardLaneHeadcountLabel,
} from '@/lib/waiter-board-lane-meta';
import {
  buildWaiterBoardStateContext,
  type WaiterTableSessionMeta,
} from '@/lib/waiter-board-session';

function boardCtx(
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
  checkoutRequestedTableIds: string[] = [],
) {
  const summaries = Object.keys(sessionMetaByTableId).map((tableId) => ({
    tableId,
    occupied: true,
  }));
  return buildWaiterBoardStateContext(
    sessionMetaByTableId,
    checkoutRequestedTableIds,
    summaries,
  );
}

describe('formatWaiterBoardLaneCountLabel', () => {
  it('keeps table count when headcount is null', () => {
    assert.equal(formatWaiterBoardLaneCountLabel('7 桌', null), '7 桌');
  });

  it('joins A/C with middle dot', () => {
    assert.equal(formatWaiterBoardLaneCountLabel('7 桌', 'A16 C2'), '7 桌 · A16 C2');
  });
});

describe('waiterBoardLaneHeadcountLabel', () => {
  const t1 = '550e8400-e29b-41d4-a716-446655440001';
  const t2 = '550e8400-e29b-41d4-a716-446655440002';

  it('returns null when gated off', () => {
    const ctx = boardCtx({
      [t1]: { sessionId: 's1', openedAt: '2026-01-01T10:00:00.000Z', status: 'open' },
    });
    const map = new Map([[t1, { adults: 2, children: 1 }]]);
    assert.equal(waiterBoardLaneHeadcountLabel([t1], ctx, map, false), null);
  });

  it('returns null when all zeros', () => {
    const ctx = boardCtx({
      [t1]: { sessionId: 's1', openedAt: '2026-01-01T10:00:00.000Z', status: 'open' },
    });
    const map = new Map([[t1, { adults: 0, children: 0 }]]);
    assert.equal(waiterBoardLaneHeadcountLabel([t1], ctx, map, true), null);
  });

  it('sums dining A/C', () => {
    const ctx = boardCtx({
      [t1]: { sessionId: 's1', openedAt: '2026-01-01T10:00:00.000Z', status: 'open' },
      [t2]: { sessionId: 's2', openedAt: '2026-01-01T10:00:00.000Z', status: 'open' },
    });
    const map = new Map([
      [t1, { adults: 2, children: 1 }],
      [t2, { adults: 3, children: 0 }],
    ]);
    assert.equal(waiterBoardLaneHeadcountLabel([t1, t2], ctx, map, true), 'A5 C1');
  });
});
