import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { datePickerNavMonths } from './date-picker-nav';

describe('datePickerNavMonths', () => {
  const now = new Date(2026, 7, 18);

  it('uses unbounded years when min/max are absent', () => {
    const nav = datePickerNavMonths(undefined, undefined, now);
    assert.equal(nav.startMonth.getFullYear(), 2023);
    assert.equal(nav.startMonth.getMonth(), 0);
    assert.equal(nav.endMonth.getFullYear(), 2034);
    assert.equal(nav.endMonth.getMonth(), 11);
  });

  it('clamps caption nav to min/max months so out-of-window years are unreachable', () => {
    const minDate = new Date(2026, 6, 19);
    const maxDate = new Date(2026, 7, 18);
    const nav = datePickerNavMonths(minDate, maxDate, now);
    assert.equal(nav.startMonth.getFullYear(), 2026);
    assert.equal(nav.startMonth.getMonth(), 6);
    assert.equal(nav.startMonth.getDate(), 1);
    assert.equal(nav.endMonth.getFullYear(), 2026);
    assert.equal(nav.endMonth.getMonth(), 7);
    assert.equal(nav.endMonth.getDate(), 31);
  });

  it('keeps unbounded end when only min is set', () => {
    const minDate = new Date(2026, 6, 19);
    const nav = datePickerNavMonths(minDate, undefined, now);
    assert.equal(nav.startMonth.getFullYear(), 2026);
    assert.equal(nav.startMonth.getMonth(), 6);
    assert.equal(nav.endMonth.getFullYear(), 2034);
  });
});
