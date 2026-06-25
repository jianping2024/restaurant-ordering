import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activeSessionIdByTableIdFromMeta,
  classifyWaiterTableBoardState,
  computeWaiterBoardStats,
  filterWaiterBoardTableIds,
  filterWaiterBoardTableIdsBySearch,
  formatSessionDurationHm,
  tableMatchesWaiterBoardSearch,
} from './waiter-board-session';

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

  it('counts idle, open, and checkout tables', () => {
    const stats = computeWaiterBoardStats(
      [t1, t2, t3, t4],
      {
        [t2]: { sessionId: 's2', openedAt: '2026-01-01T10:00:00.000Z', status: 'open' },
        [t3]: { sessionId: 's3', openedAt: '2026-01-01T10:00:00.000Z', status: 'billing' },
      },
      [t4],
    );
    assert.deepEqual(stats, {
      total: 4,
      idle: 1,
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
    assert.equal(classifyWaiterTableBoardState(t1, meta, [t1]), 'checkout');
  });

  it('returns dining for open session without checkout', () => {
    assert.equal(classifyWaiterTableBoardState(t2, meta, []), 'dining');
  });

  it('returns idle when no session', () => {
    assert.equal(classifyWaiterTableBoardState(t1, meta, []), 'idle');
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

  it('filters by board state', () => {
    assert.deepEqual(filterWaiterBoardTableIds(ids, 'all', meta, []), ids);
    assert.deepEqual(filterWaiterBoardTableIds(ids, 'dining', meta, []), [ids[1]]);
    assert.deepEqual(filterWaiterBoardTableIds(ids, 'checkout', meta, []), [ids[2]]);
    assert.deepEqual(filterWaiterBoardTableIds(ids, 'idle', meta, []), [ids[0]]);
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
