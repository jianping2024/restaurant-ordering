import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isRestaurantSuspended } from '@mesa/shared';

describe('isRestaurantSuspended', () => {
  it('returns false for null/undefined/empty', () => {
    assert.equal(isRestaurantSuspended(null), false);
    assert.equal(isRestaurantSuspended(undefined), false);
    assert.equal(isRestaurantSuspended(''), false);
  });

  it('returns true when suspended_at is set', () => {
    assert.equal(isRestaurantSuspended('2026-06-23T12:00:00.000Z'), true);
  });
});
