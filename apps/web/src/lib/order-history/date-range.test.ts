import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ORDER_HISTORY_DEFAULT_RANGE_DAYS,
  ORDER_HISTORY_MAX_RANGE_DAYS,
  clampOrderHistoryPickerRange,
  defaultOrderHistoryClosedRange,
  formatOrderHistoryDateKey,
  parseOrderHistoryClosedRange,
} from './date-range';

describe('defaultOrderHistoryClosedRange', () => {
  it('returns an inclusive last-7-day window ending today (Lisbon calendar)', () => {
    const range = defaultOrderHistoryClosedRange(new Date('2026-08-09T15:00:00.000Z'));
    assert.equal(range.closedTo, '2026-08-09');
    assert.equal(range.closedFrom, '2026-08-03');
    assert.equal(ORDER_HISTORY_DEFAULT_RANGE_DAYS, 7);
  });
});

describe('parseOrderHistoryClosedRange', () => {
  it('applies default when both dates missing and applyDefaultWhenMissing', () => {
    const parsed = parseOrderHistoryClosedRange({
      applyDefaultWhenMissing: true,
      now: new Date('2026-08-09T15:00:00.000Z'),
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.range, { closedFrom: '2026-08-03', closedTo: '2026-08-09' });
  });

  it('rejects missing dates without default', () => {
    const parsed = parseOrderHistoryClosedRange({});
    assert.deepEqual(parsed, { ok: false, code: 'invalid_date_range' });
  });

  it('rejects ranges longer than 31 inclusive days', () => {
    const parsed = parseOrderHistoryClosedRange({
      closedFrom: '2026-07-01',
      closedTo: '2026-08-01',
    });
    assert.deepEqual(parsed, { ok: false, code: 'invalid_date_range' });
  });

  it('accepts a 31-day inclusive window', () => {
    const parsed = parseOrderHistoryClosedRange({
      closedFrom: '2026-07-01',
      closedTo: '2026-07-31',
    });
    assert.equal(parsed.ok, true);
    assert.equal(ORDER_HISTORY_MAX_RANGE_DAYS, 31);
  });
});

describe('clampOrderHistoryPickerRange', () => {
  it('caps to 31 inclusive days from start', () => {
    const from = new Date(2026, 6, 1);
    const to = new Date(2026, 7, 15);
    const clamped = clampOrderHistoryPickerRange({ from, to });
    assert.ok(clamped);
    assert.equal(formatOrderHistoryDateKey(clamped!.from), '2026-07-01');
    assert.equal(formatOrderHistoryDateKey(clamped!.to), '2026-07-31');
  });
});
