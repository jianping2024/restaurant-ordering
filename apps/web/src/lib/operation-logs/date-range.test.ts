import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OPERATION_LOG_MAX_LOOKBACK_DAYS,
  OPERATION_LOG_MAX_RANGE_DAYS,
  defaultOperationLogsDateRange,
  operationLogRetentionCutoffUtcIso,
  parseOperationLogsDateRange,
} from './date-range';

describe('defaultOperationLogsDateRange', () => {
  it('returns an inclusive last-7-day window ending today (Lisbon calendar)', () => {
    const range = defaultOperationLogsDateRange(new Date('2026-08-09T15:00:00.000Z'));
    assert.equal(range.endDate, '2026-08-09');
    assert.equal(range.startDate, '2026-08-03');
    assert.equal(OPERATION_LOG_MAX_RANGE_DAYS, 7);
    assert.equal(OPERATION_LOG_MAX_LOOKBACK_DAYS, 7);
  });
});

describe('parseOperationLogsDateRange', () => {
  const now = new Date('2026-08-09T15:00:00.000Z');

  it('defaults missing dates to last 7 days', () => {
    const parsed = parseOperationLogsDateRange({ now });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.startDate, '2026-08-03');
    assert.equal(parsed.endDate, '2026-08-09');
  });

  it('rejects ranges longer than 7 inclusive days', () => {
    const parsed = parseOperationLogsDateRange({
      startDate: '2026-08-01',
      endDate: '2026-08-09',
      now,
    });
    assert.deepEqual(parsed, { ok: false, code: 'invalid_date_range' });
  });

  it('rejects start before 7-day lookback', () => {
    const parsed = parseOperationLogsDateRange({
      startDate: '2026-08-01',
      endDate: '2026-08-02',
      now,
    });
    assert.deepEqual(parsed, { ok: false, code: 'invalid_date_range' });
  });

  it('accepts a 7-day inclusive window within lookback', () => {
    const parsed = parseOperationLogsDateRange({
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      now,
    });
    assert.equal(parsed.ok, true);
  });
});

describe('operationLogRetentionCutoffUtcIso', () => {
  it('matches earliest queryable day start', () => {
    const parsed = parseOperationLogsDateRange({ now: new Date('2026-08-09T15:00:00.000Z') });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(
      operationLogRetentionCutoffUtcIso(new Date('2026-08-09T15:00:00.000Z')),
      parsed.startUtc,
    );
  });
});
