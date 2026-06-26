import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addCalendarDays,
  calendarDateInTimezone,
  compareAbnormalOperations,
  daysBetweenInclusive,
  parseAbnormalOperationsDateRange,
  riskLevelForVoidedItem,
  canTransitionAbnormalStatus,
} from './abnormal-operations';
import {
  requiresAbnormalReasonDetail,
  isValidAbnormalReason,
} from '@/lib/audit/reasons';

const FIXED_NOW = new Date('2026-06-26T12:00:00.000Z');

describe('riskLevelForVoidedItem', () => {
  it('maps item_status to risk levels', () => {
    assert.equal(riskLevelForVoidedItem('pending'), 'LOW');
    assert.equal(riskLevelForVoidedItem('cooking'), 'MEDIUM');
    assert.equal(riskLevelForVoidedItem('done'), 'HIGH');
  });
});

describe('requiresAbnormalReasonDetail', () => {
  it('requires detail for other reasons', () => {
    assert.equal(requiresAbnormalReasonDetail('discount', 'other'), true);
    assert.equal(requiresAbnormalReasonDetail('discount', 'owner_approved'), false);
  });

  it('requires detail when voiding served items', () => {
    assert.equal(
      requiresAbnormalReasonDetail('void_item', 'staff_mistake', { voidItemWasServed: true }),
      true,
    );
    assert.equal(
      requiresAbnormalReasonDetail('void_item', 'staff_mistake', { voidItemWasServed: false }),
      false,
    );
  });
});

describe('isValidAbnormalReason', () => {
  it('accepts known reason codes', () => {
    assert.equal(isValidAbnormalReason('unpaid_close', 'left_unpaid'), true);
    assert.equal(isValidAbnormalReason('unpaid_close', 'nope'), false);
  });
});

describe('parseAbnormalOperationsDateRange', () => {
  it('defaults to today in Lisbon', () => {
    const parsed = parseAbnormalOperationsDateRange({ now: FIXED_NOW });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const today = calendarDateInTimezone(FIXED_NOW);
    assert.equal(parsed.startDate, today);
    assert.equal(parsed.endDate, today);
    assert.ok(parsed.startUtc < parsed.endExclusiveUtc);
  });

  it('rejects ranges longer than 31 days', () => {
    const today = calendarDateInTimezone(FIXED_NOW);
    const start = addCalendarDays(today, -30);
    const parsed = parseAbnormalOperationsDateRange({
      startDate: start,
      endDate: today,
      now: FIXED_NOW,
    });
    assert.equal(parsed.ok, true);

    const tooEarly = addCalendarDays(today, -31);
    const rejected = parseAbnormalOperationsDateRange({
      startDate: tooEarly,
      endDate: today,
      now: FIXED_NOW,
    });
    assert.equal(rejected.ok, false);
    if (rejected.ok) return;
    assert.equal(rejected.code, 'invalid_date_range');
  });

  it('rejects future end dates and lookback beyond 90 days', () => {
    const today = calendarDateInTimezone(FIXED_NOW);
    const future = addCalendarDays(today, 1);
    assert.equal(
      parseAbnormalOperationsDateRange({ endDate: future, now: FIXED_NOW }).ok,
      false,
    );

    const tooOld = addCalendarDays(today, -90);
    assert.equal(
      parseAbnormalOperationsDateRange({ startDate: tooOld, endDate: today, now: FIXED_NOW }).ok,
      false,
    );
  });
});

describe('daysBetweenInclusive', () => {
  it('counts inclusive calendar days', () => {
    assert.equal(daysBetweenInclusive('2026-06-01', '2026-06-01'), 1);
    assert.equal(daysBetweenInclusive('2026-06-01', '2026-06-02'), 2);
  });
});

describe('compareAbnormalOperations', () => {
  it('sorts HIGH before MEDIUM before LOW, then newest first', () => {
    const rows = [
      { risk_level: 'LOW' as const, created_at: '2026-06-26T10:00:00.000Z' },
      { risk_level: 'HIGH' as const, created_at: '2026-06-26T09:00:00.000Z' },
      { risk_level: 'HIGH' as const, created_at: '2026-06-26T11:00:00.000Z' },
      { risk_level: 'MEDIUM' as const, created_at: '2026-06-26T12:00:00.000Z' },
    ].sort(compareAbnormalOperations);

    assert.deepEqual(
      rows.map((row) => `${row.risk_level}:${row.created_at}`),
      [
        'HIGH:2026-06-26T11:00:00.000Z',
        'HIGH:2026-06-26T09:00:00.000Z',
        'MEDIUM:2026-06-26T12:00:00.000Z',
        'LOW:2026-06-26T10:00:00.000Z',
      ],
    );
  });
});

describe('canTransitionAbnormalStatus', () => {
  it('allows documented transitions', () => {
    assert.equal(canTransitionAbnormalStatus('PENDING', 'CONFIRMED'), true);
    assert.equal(canTransitionAbnormalStatus('PENDING', 'IGNORED'), true);
    assert.equal(canTransitionAbnormalStatus('CONFIRMED', 'IGNORED'), true);
    assert.equal(canTransitionAbnormalStatus('IGNORED', 'CONFIRMED'), true);
    assert.equal(canTransitionAbnormalStatus('PENDING', 'PENDING'), true);
    assert.equal(canTransitionAbnormalStatus('CONFIRMED', 'PENDING'), false);
  });
});
