import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatBuffetGuestCountsOptional } from '@/lib/buffet-order';

const labels = { adults: '{n}大人', children: '{n}小孩' };

describe('formatBuffetGuestCountsOptional', () => {
  it('shows both segments when counts are positive', () => {
    assert.equal(formatBuffetGuestCountsOptional(2, 1, labels), '2大人 · 1小孩');
  });

  it('omits zero adult segment', () => {
    assert.equal(formatBuffetGuestCountsOptional(0, 3, labels), '3小孩');
  });

  it('omits zero child segment', () => {
    assert.equal(formatBuffetGuestCountsOptional(4, 0, labels), '4大人');
  });

  it('returns empty when both are zero', () => {
    assert.equal(formatBuffetGuestCountsOptional(0, 0, labels), '');
  });
});
