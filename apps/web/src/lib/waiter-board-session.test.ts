import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activeSessionIdByTableIdFromMeta,
  computeWaiterBoardStats,
  formatSessionDurationHm,
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
