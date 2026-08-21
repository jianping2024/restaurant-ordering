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
    const patch = parseFeatureFlagsRecord({
      kitchen_serve_to_table: true,
      bill_receipt_print: false,
    });
    assert.deepEqual(patch, { kitchen_serve_to_table: true, bill_receipt_print: false });
  });

  it('ignores unknown and retired keys', () => {
    const patch = parseFeatureFlagsRecord({
      kitchen_board: true,
      bill_receipt_print: true,
      unknown_flag: true,
    });
    assert.deepEqual(patch, { bill_receipt_print: true });
  });

  it('rejects non-boolean values', () => {
    assert.equal(parseFeatureFlagsRecord({ bill_receipt_print: 'yes' }), null);
  });

  it('returns null for empty patch after filtering', () => {
    assert.equal(parseFeatureFlagsRecord({ kitchen_board: true, unknown: true }), null);
  });
});

describe('mergeRestaurantFeatureFlags', () => {
  it('merges patch over stored values', () => {
    const merged = mergeRestaurantFeatureFlags(
      { kitchen_serve_to_table: false },
      { bill_receipt_print: true },
    );
    assert.equal(merged.kitchen_serve_to_table, false);
    assert.equal(merged.bill_receipt_print, true);
  });
});

describe('mergeRestaurantFeatureFlagsJsonb', () => {
  it('preserves flags managed outside the features registry and strips retired kitchen_board', () => {
    const merged = mergeRestaurantFeatureFlagsJsonb(
      { geo_order_restriction: false, kitchen_board: true },
      { bill_receipt_print: true },
    );
    assert.equal(merged.geo_order_restriction, false);
    assert.equal(merged.kitchen_board, undefined);
    assert.equal(merged.bill_receipt_print, true);
  });

  it('applies registry defaults for missing known keys', () => {
    const merged = mergeRestaurantFeatureFlagsJsonb(
      { geo_order_restriction: true },
      { kitchen_serve_to_table: true },
    );
    assert.equal(merged.geo_order_restriction, true);
    assert.equal(merged.kitchen_serve_to_table, true);
    assert.equal(merged.bill_receipt_print, false);
    assert.equal(merged.bill_sync_to_fiscal, false);
  });
});

describe('normalizeRestaurantFeatureFlags', () => {
  it('applies defaults for missing keys', () => {
    const flags = normalizeRestaurantFeatureFlags({});
    assert.equal(flags.bill_receipt_print, false);
    assert.equal(flags.kitchen_serve_to_table, false);
    assert.equal(flags.bill_sync_to_fiscal, false);
    assert.equal('kitchen_board' in flags, false);
  });
});
