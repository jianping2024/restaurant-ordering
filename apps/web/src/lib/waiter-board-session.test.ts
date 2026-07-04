import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activeSessionIdByTableIdFromMeta,
  buildWaiterBoardStateContext,
  classifyWaiterTableBoardState,
  computeWaiterBoardStats,
  filterWaiterBoardTableIds,
  filterWaiterBoardTableIdsBySearch,
  formatSessionDurationHm,
  tableMatchesWaiterBoardSearch,
  type WaiterBoardStateContext,
  type WaiterTableSessionMeta,
} from './waiter-board-session';

function boardCtx(
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
  checkoutRequestedTableIds: string[] = [],
  occupied: Record<string, boolean> = {},
): WaiterBoardStateContext {
  return buildWaiterBoardStateContext(
    sessionMetaByTableId,
    checkoutRequestedTableIds,
    Object.entries(occupied).map(([tableId, occupiedFlag]) => ({
      tableId,
      occupied: occupiedFlag,
    })),
  );
}

describe('formatSessionDurationHm', () => {
  it('formats hours and minutes in zh', () => {
    const start = '2026-01-01T10:00:00.000Z';
    const end = '2026-01-01T11:25:00.000Z';
    assert.equal(formatSessionDurationHm(start, end, 'zh', Date.parse(end)), '1小时25分');
  });

  it('formats minutes only when under one hour', () => {
    const start = '2026-01-01T10:00:00.000Z';
    const end = '2026-01-01T10:45:00.000Z';
    assert.equal(formatSessionDurationHm(start, end, 'zh', Date.parse(end)), '45分');
  });

  it('uses now when end is null', () => {
    const start = '2026-01-01T10:00:00.000Z';
    const now = Date.parse('2026-01-01T12:30:00.000Z');
    assert.equal(formatSessionDurationHm(start, null, 'en', now), '2h 30m');
  });
});

describe('activeSessionIdByTableIdFromMeta', () => {
  it('maps table ids to session ids', () => {
    assert.deepEqual(
      activeSessionIdByTableIdFromMeta({
        t1: { sessionId: 's1', openedAt: '2026-01-01T10:00:00.000Z', status: 'open' },
      }),
      { t1: 's1' },
    );
  });
});

describe('computeWaiterBoardStats', () => {
  const t1 = '550e8400-e29b-41d4-a716-446655440001';
  const t2 = '550e8400-e29b-41d4-a716-446655440002';
  const t3 = '550e8400-e29b-41d4-a716-446655440003';
  const t4 = '550e8400-e29b-41d4-a716-446655440004';
  const t5 = '550e8400-e29b-41d4-a716-446655440005';

  it('counts idle, dining, and checkout tables via classifier', () => {
    const ctx = boardCtx(
      {
        [t2]: { sessionId: 's2', openedAt: '2026-01-01T10:00:00.000Z', status: 'open' },
        [t3]: { sessionId: 's3', openedAt: '2026-01-01T10:00:00.000Z', status: 'billing' },
        [t5]: { sessionId: 's5', openedAt: '2026-01-01T10:00:00.000Z', status: 'open' },
      },
      [t4],
      { [t2]: true, [t5]: false },
    );
    const stats = computeWaiterBoardStats([t1, t2, t3, t4, t5], ctx);
    assert.deepEqual(stats, {
      total: 5,
      idle: 2,
      open: 1,
      checkoutPending: 2,
    });
  });
});

describe('classifyWaiterTableBoardState', () => {
  const t1 = '550e8400-e29b-41d4-a716-446655440001';
  const t2 = '550e8400-e29b-41d4-a716-446655440002';
  const meta = {
    [t2]: { sessionId: 's2', openedAt: '2026-01-01T10:00:00.000Z', status: 'open' as const },
  };

  it('returns checkout when checkout requested', () => {
    assert.equal(classifyWaiterTableBoardState(t1, boardCtx(meta, [t1])), 'checkout');
  });

  it('returns dining for occupied open session without checkout', () => {
    assert.equal(classifyWaiterTableBoardState(t2, boardCtx(meta, [], { [t2]: true })), 'dining');
  });

  it('returns idle for unoccupied open session', () => {
    assert.equal(classifyWaiterTableBoardState(t2, boardCtx(meta, [], { [t2]: false })), 'idle');
  });

  it('returns idle when no session', () => {
    assert.equal(classifyWaiterTableBoardState(t1, boardCtx(meta, [])), 'idle');
  });
});

describe('filterWaiterBoardTableIds', () => {
  const ids = [
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440003',
  ];
  const meta = {
    [ids[1]]: {
      sessionId: 's2',
      openedAt: '2026-01-01T10:00:00.000Z',
      status: 'open' as const,
    },
    [ids[2]]: {
      sessionId: 's3',
      openedAt: '2026-01-01T10:00:00.000Z',
      status: 'billing' as const,
    },
  };
  const ctx = boardCtx(meta, [], { [ids[1]]: true });

  it('filters by board state', () => {
    assert.deepEqual(filterWaiterBoardTableIds(ids, 'all', ctx), ids);
    assert.deepEqual(filterWaiterBoardTableIds(ids, 'dining', ctx), [ids[1]]);
    assert.deepEqual(filterWaiterBoardTableIds(ids, 'checkout', ctx), [ids[2]]);
    assert.deepEqual(filterWaiterBoardTableIds(ids, 'idle', ctx), [ids[0]]);
  });
});

describe('tableMatchesWaiterBoardSearch', () => {
  it('matches display name case-insensitively', () => {
    assert.equal(tableMatchesWaiterBoardSearch('A-12', 'a-1'), true);
    assert.equal(tableMatchesWaiterBoardSearch('包间 3', '包间'), true);
    assert.equal(tableMatchesWaiterBoardSearch('A-12', 'b'), false);
    assert.equal(tableMatchesWaiterBoardSearch('A-12', ''), true);
    assert.equal(tableMatchesWaiterBoardSearch('A-12', '   '), true);
  });
});

describe('filterWaiterBoardTableIdsBySearch', () => {
  const nameById = new Map([
    ['t1', 'A-01'],
    ['t2', 'B-02'],
    ['t3', '包间 1'],
  ]);

  it('returns all ids when query is empty', () => {
    assert.deepEqual(filterWaiterBoardTableIdsBySearch(['t1', 't2'], nameById, ''), [
      't1',
      't2',
    ]);
  });

  it('filters by display name substring', () => {
    assert.deepEqual(filterWaiterBoardTableIdsBySearch(['t1', 't2', 't3'], nameById, 'b'), [
      't2',
    ]);
    assert.deepEqual(filterWaiterBoardTableIdsBySearch(['t1', 't2', 't3'], nameById, '包间'), [
      't3',
    ]);
  });
});
