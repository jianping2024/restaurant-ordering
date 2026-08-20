import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lisbonDayStartUtcIso } from '@/lib/lisbon-calendar';
import {
  defaultOperationLogsDay,
  operationLogRetentionCutoffUtcIso,
  parseOperationLogsDay,
} from './date-range';

describe('defaultOperationLogsDay', () => {
  it('returns Lisbon calendar today', () => {
    assert.equal(
      defaultOperationLogsDay(new Date('2026-08-09T15:00:00.000Z')),
      '2026-08-09',
    );
  });
});

describe('parseOperationLogsDay', () => {
  const now = new Date('2026-08-09T15:00:00.000Z');

  it('defaults missing date to today', () => {
    const parsed = parseOperationLogsDay({ now, retentionDays: 7 });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.date, '2026-08-09');
    assert.equal(parsed.startUtc, lisbonDayStartUtcIso('2026-08-09'));
    assert.equal(parsed.endExclusiveUtc, lisbonDayStartUtcIso('2026-08-10'));
  });

  it('accepts a day within retention lookback', () => {
    const parsed = parseOperationLogsDay({
      date: '2026-08-03',
      now,
      retentionDays: 7,
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.date, '2026-08-03');
  });

  it('rejects a day before retention lookback', () => {
    const parsed = parseOperationLogsDay({
      date: '2026-08-01',
      now,
      retentionDays: 7,
    });
    assert.deepEqual(parsed, { ok: false, code: 'invalid_date_range' });
  });

  it('rejects future days', () => {
    const parsed = parseOperationLogsDay({
      date: '2026-08-10',
      now,
      retentionDays: 7,
    });
    assert.deepEqual(parsed, { ok: false, code: 'invalid_date_range' });
  });

  it('respects wider retention windows', () => {
    const parsed = parseOperationLogsDay({
      date: '2026-07-27',
      now,
      retentionDays: 14,
    });
    assert.equal(parsed.ok, true);
  });
});

describe('operationLogRetentionCutoffUtcIso', () => {
  it('matches earliest queryable day start', () => {
    const parsed = parseOperationLogsDay({
      date: '2026-08-03',
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
