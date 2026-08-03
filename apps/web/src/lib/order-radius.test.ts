import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ORDER_RADIUS_METERS,
  normalizeOrderRadiusMeters,
  parseOrderRadiusInput,
} from './order-radius';

describe('order-radius default', () => {
  it('defaults unset/invalid to 1 km coarse fence', () => {
    assert.equal(DEFAULT_ORDER_RADIUS_METERS, 1000);
    assert.equal(normalizeOrderRadiusMeters(undefined), 1000);
    assert.equal(normalizeOrderRadiusMeters(Number.NaN), 1000);
    assert.equal(normalizeOrderRadiusMeters('not-a-number'), 1000);
    assert.equal(parseOrderRadiusInput(''), 1000);
  });
});
