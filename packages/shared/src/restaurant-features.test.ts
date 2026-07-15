import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeRestaurantFeatureFlags,
  mergeRestaurantFeatureFlagsJsonb,
  normalizeRestaurantFeatureFlags,
  parseFeatureFlagsRecord,
} from './restaurant-features';

describe('parseFeatureFlagsRecord', () => {
  it('accepts known boolean keys', () => {
    const patch = parseFeatureFlagsRecord({ kitchen_board: true, bill_receipt_print: false });
    assert.deepEqual(patch, { kitchen_board: true, bill_receipt_print: false });
  });

  it('ignores unknown keys', () => {
    const patch = parseFeatureFlagsRecord({ kitchen_board: true, unknown_flag: true });
    assert.deepEqual(patch, { kitchen_board: true });
  });

  it('rejects non-boolean values', () => {
    assert.equal(parseFeatureFlagsRecord({ kitchen_board: 'yes' }), null);
  });

  it('returns null for empty patch after filtering', () => {
    assert.equal(parseFeatureFlagsRecord({ unknown: true }), null);
  });
});

describe('mergeRestaurantFeatureFlags', () => {
  it('merges patch over stored values', () => {
    const merged = mergeRestaurantFeatureFlags(
      { kitchen_board: false },
      { bill_receipt_print: true },
    );
    assert.equal(merged.kitchen_board, false);
    assert.equal(merged.bill_receipt_print, true);
  });
});

describe('mergeRestaurantFeatureFlagsJsonb', () => {
  it('preserves flags managed outside the features registry', () => {
    const merged = mergeRestaurantFeatureFlagsJsonb(
      { geo_order_restriction: false, kitchen_board: true },
      { bill_receipt_print: true },
    );
    assert.equal(merged.geo_order_restriction, false);
    assert.equal(merged.kitchen_board, true);
    assert.equal(merged.bill_receipt_print, true);
  });

  it('applies registry defaults for missing known keys', () => {
    const merged = mergeRestaurantFeatureFlagsJsonb(
      { geo_order_restriction: true },
      { kitchen_board: true },
    );
    assert.equal(merged.geo_order_restriction, true);
    assert.equal(merged.kitchen_board, true);
    assert.equal(merged.bill_receipt_print, false);
  });
});

describe('normalizeRestaurantFeatureFlags', () => {
  it('applies defaults for missing keys', () => {
    const flags = normalizeRestaurantFeatureFlags({});
    assert.equal(flags.kitchen_board, false);
    assert.equal(flags.bill_receipt_print, false);
  });
});
