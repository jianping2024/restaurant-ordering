import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeRestaurantFeatureFlags,
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

describe('normalizeRestaurantFeatureFlags', () => {
  it('applies defaults for missing keys', () => {
    const flags = normalizeRestaurantFeatureFlags({});
    assert.equal(flags.kitchen_board, false);
    assert.equal(flags.bill_receipt_print, false);
  });
});
