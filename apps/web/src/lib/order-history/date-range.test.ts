import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultOrderHistoryClosedRange } from './date-range';

describe('defaultOrderHistoryClosedRange', () => {
  it('returns today-only window (Lisbon calendar)', () => {
    const range = defaultOrderHistoryClosedRange(new Date('2026-08-09T15:00:00.000Z'));
    assert.equal(range.closedTo, '2026-08-09');
    assert.equal(range.closedFrom, '2026-08-09');
  });
});
