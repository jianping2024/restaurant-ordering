import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ORDER_RADIUS_METERS,
  normalizeOrderRadiusMeters,
  parseOrderRadiusInput,
} from './order-radius';

describe('order-radius default', () => {
  it('defaults unset/invalid to 500 m fence', () => {
    assert.equal(DEFAULT_ORDER_RADIUS_METERS, 500);
    assert.equal(normalizeOrderRadiusMeters(undefined), 500);
    assert.equal(normalizeOrderRadiusMeters(Number.NaN), 500);
    assert.equal(normalizeOrderRadiusMeters('not-a-number'), 500);
    assert.equal(parseOrderRadiusInput(''), 500);
  });
});
