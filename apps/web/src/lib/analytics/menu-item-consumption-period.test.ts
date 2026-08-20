import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clampConsumptionPeriod,
  defaultConsumptionPeriod,
  listMonthPeriods,
  listQuarterPeriods,
  listYearPeriods,
  resolveConsumptionPeriodWindow,
} from '@/lib/analytics/menu-item-consumption-period';

describe('menu-item-consumption-period', () => {
  it('defaults to current month/quarter/year', () => {
    assert.equal(defaultConsumptionPeriod('month', '2026-08-20'), '2026-08');
    assert.equal(defaultConsumptionPeriod('quarter', '2026-08-20'), '2026-Q3');
    assert.equal(defaultConsumptionPeriod('year', '2026-08-20'), '2026');
  });

  it('resolves month window capped at today', () => {
    const win = resolveConsumptionPeriodWindow('month', '2026-08', '2026-08-20');
    assert.deepEqual(win, { startDate: '2026-08-01', endDate: '2026-08-20' });
  });

  it('resolves full past month', () => {
    const win = resolveConsumptionPeriodWindow('month', '2026-07', '2026-08-20');
    assert.deepEqual(win, { startDate: '2026-07-01', endDate: '2026-07-31' });
  });

  it('resolves quarter and year windows', () => {
    assert.deepEqual(resolveConsumptionPeriodWindow('quarter', '2026-Q2', '2026-08-20'), {
      startDate: '2026-04-01',
      endDate: '2026-06-30',
    });
    assert.deepEqual(resolveConsumptionPeriodWindow('year', '2026', '2026-08-20'), {
      startDate: '2026-01-01',
      endDate: '2026-08-20',
    });
  });

  it('clamps future and before earliest', () => {
    assert.equal(
      clampConsumptionPeriod('month', '2026-12', '2026-08-20', '2026-06-27'),
      '2026-08',
    );
    assert.equal(
      clampConsumptionPeriod('month', '2026-01', '2026-08-20', '2026-06-27'),
      '2026-06',
    );
  });

  it('lists periods from earliest to today', () => {
    assert.deepEqual(listMonthPeriods('2026-06-27', '2026-08-20'), [
      '2026-06',
      '2026-07',
      '2026-08',
    ]);
    assert.deepEqual(listQuarterPeriods('2026-06-27', '2026-08-20'), ['2026-Q2', '2026-Q3']);
    assert.deepEqual(listYearPeriods('2025-12-01', '2026-08-20'), ['2025', '2026']);
  });
});
