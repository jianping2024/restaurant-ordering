import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  defaultOperationLogsDateRange,
  operationLogRetentionCutoffUtcIso,
  parseOperationLogsDateRange,
} from './date-range';
import { OPERATION_LOG_RETENTION_DAYS_DEFAULT } from './retention-days';

describe('defaultOperationLogsDateRange', () => {
  it('returns an inclusive last-7-day window ending today (Lisbon calendar)', () => {
    const range = defaultOperationLogsDateRange(
      new Date('2026-08-09T15:00:00.000Z'),
      OPERATION_LOG_RETENTION_DAYS_DEFAULT,
    );
    assert.equal(range.endDate, '2026-08-09');
    assert.equal(range.startDate, '2026-08-03');
  });

  it('respects configured retention days', () => {
    const range = defaultOperationLogsDateRange(new Date('2026-08-09T15:00:00.000Z'), 14);
    assert.equal(range.endDate, '2026-08-09');
    assert.equal(range.startDate, '2026-07-27');
  });
});

describe('parseOperationLogsDateRange', () => {
  const now = new Date('2026-08-09T15:00:00.000Z');

  it('defaults missing dates to last 7 days', () => {
    const parsed = parseOperationLogsDateRange({ now, retentionDays: 7 });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.startDate, '2026-08-03');
    assert.equal(parsed.endDate, '2026-08-09');
  });

  it('rejects ranges longer than retention inclusive days', () => {
    const parsed = parseOperationLogsDateRange({
      startDate: '2026-08-01',
      endDate: '2026-08-09',
      now,
      retentionDays: 7,
    });
    assert.deepEqual(parsed, { ok: false, code: 'invalid_date_range' });
  });

  it('rejects start before retention lookback', () => {
    const parsed = parseOperationLogsDateRange({
      startDate: '2026-08-01',
      endDate: '2026-08-02',
      now,
      retentionDays: 7,
    });
    assert.deepEqual(parsed, { ok: false, code: 'invalid_date_range' });
  });

  it('accepts a 7-day inclusive window within lookback', () => {
    const parsed = parseOperationLogsDateRange({
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      now,
      retentionDays: 7,
    });
    assert.equal(parsed.ok, true);
  });

  it('allows wider windows when retention is 14 days', () => {
    const parsed = parseOperationLogsDateRange({
      startDate: '2026-07-27',
      endDate: '2026-08-09',
      now,
      retentionDays: 14,
    });
    assert.equal(parsed.ok, true);
  });
});

describe('operationLogRetentionCutoffUtcIso', () => {
  it('matches earliest queryable day start', () => {
    const parsed = parseOperationLogsDateRange({
      now: new Date('2026-08-09T15:00:00.000Z'),
      retentionDays: 7,
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(
      operationLogRetentionCutoffUtcIso(new Date('2026-08-09T15:00:00.000Z'), 7),
      parsed.startUtc,
    );
  });
});
