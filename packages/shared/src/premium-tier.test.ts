import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canUsePremiumFeature,
  isProEffective,
  normalizePremiumKeyGrants,
  normalizePremiumKeys,
  normalizeRestaurantPlan,
  parseProFeatureProduct,
  parseSubscriptionBaseProduct,
  proTrialValidUntil,
  quoteProFeaturesEur,
  quoteRestaurantSubscriptionEur,
  quoteSubscriptionBaseEur,
  sanitizePremiumKeyGrants,
  PRO_TRIAL_DAYS,
} from './premium-tier';
import {
  addLisbonCalendarDays,
  licenseValidUntilEndOfLisbonDay,
  lisbonCalendarDateFromInstant,
} from './license-calendar';

describe('premium-tier', () => {
  it('normalizeRestaurantPlan maps free/missing to basic and keeps pro', () => {
    assert.equal(normalizeRestaurantPlan('pro'), 'pro');
    assert.equal(normalizeRestaurantPlan('basic'), 'basic');
    assert.equal(normalizeRestaurantPlan('free'), 'basic');
    assert.equal(normalizeRestaurantPlan(null), 'basic');
    assert.equal(normalizeRestaurantPlan(undefined), 'basic');
    assert.equal(normalizeRestaurantPlan('other'), 'basic');
  });

  it('proTrialValidUntil is Lisbon calendar day + PRO_TRIAL_DAYS end-of-day', () => {
    const from = new Date('2026-01-01T12:00:00.000Z');
    const startYmd = lisbonCalendarDateFromInstant(from);
    const endYmd = addLisbonCalendarDays(startYmd, PRO_TRIAL_DAYS);
    assert.equal(proTrialValidUntil(from), licenseValidUntilEndOfLisbonDay(endYmd));
  });

  it('isProEffective requires plan pro and valid windows', () => {
    const now = new Date('2026-06-15T00:00:00.000Z');
    assert.equal(
      isProEffective({
        plan: 'pro',
        proValidUntil: '2026-12-31T00:00:00.000Z',
        licenseValidUntil: '2026-12-31T00:00:00.000Z',
        now,
      }),
      true,
    );
    assert.equal(
      isProEffective({
        plan: 'basic',
        proValidUntil: '2026-12-31T00:00:00.000Z',
        licenseValidUntil: null,
        now,
      }),
      false,
    );
    assert.equal(
      isProEffective({
        plan: 'pro',
        proValidUntil: '2026-01-01T00:00:00.000Z',
        licenseValidUntil: null,
        now,
      }),
      false,
    );
    assert.equal(
      isProEffective({
        plan: 'pro',
        proValidUntil: null,
        licenseValidUntil: '2026-01-01T00:00:00.000Z',
        now,
      }),
      false,
    );
  });

  it('canUsePremiumFeature requires effective Pro and a grant', () => {
    const now = new Date('2026-06-15T00:00:00.000Z');
    assert.equal(
      canUsePremiumFeature({
        premiumKey: 'value_analytics',
        entitledKeys: ['value_analytics'],
        plan: 'pro',
        proValidUntil: '2026-12-31T00:00:00.000Z',
        licenseValidUntil: null,
        now,
      }),
      true,
    );
    assert.equal(
      canUsePremiumFeature({
        premiumKey: 'value_analytics',
        entitledKeys: ['abnormal_ops'],
        plan: 'pro',
        proValidUntil: '2026-12-31T00:00:00.000Z',
        licenseValidUntil: null,
        now,
      }),
      false,
    );
    assert.equal(
      canUsePremiumFeature({
        premiumKey: 'value_analytics',
        entitledKeys: ['value_analytics'],
        plan: 'basic',
        proValidUntil: null,
        licenseValidUntil: null,
        now,
      }),
      false,
    );
  });

  it('normalizePremiumKeys allows empty catalog; falls back when missing/invalid', () => {
    assert.deepEqual(normalizePremiumKeys(null), [
      'value_analytics',
      'abnormal_ops',
      'operation_logs',
      'menu_dish_video',
      'menu_dish_list_video',
    ]);
    assert.deepEqual(normalizePremiumKeys([]), []);
    assert.deepEqual(normalizePremiumKeys(['value_analytics']), ['value_analytics']);
    assert.deepEqual(normalizePremiumKeys(['not_a_key']), [
      'value_analytics',
      'abnormal_ops',
      'operation_logs',
      'menu_dish_video',
      'menu_dish_list_video',
    ]);
  });

  it('normalizePremiumKeyGrants keeps empty and drops invalid', () => {
    assert.deepEqual(normalizePremiumKeyGrants(null), []);
    assert.deepEqual(normalizePremiumKeyGrants([]), []);
    assert.deepEqual(normalizePremiumKeyGrants(['value_analytics', 'nope']), ['value_analytics']);
  });

  it('sanitizePremiumKeyGrants drops list video without parent dish video', () => {
    assert.deepEqual(sanitizePremiumKeyGrants(['menu_dish_list_video']), []);
    assert.deepEqual(sanitizePremiumKeyGrants(['menu_dish_list_video', 'menu_dish_video']), [
      'menu_dish_video',
      'menu_dish_list_video',
    ]);
  });

  it('quoteProFeaturesEur sums active list prices', () => {
    const products = [
      parseProFeatureProduct({
        feature_key: 'value_analytics',
        price_month_eur: 10,
        price_year_eur: 100,
        active: true,
      })!,
      parseProFeatureProduct({
        feature_key: 'menu_dish_video',
        price_month_eur: 5.5,
        price_year_eur: 55,
        active: true,
      })!,
      parseProFeatureProduct({
        feature_key: 'abnormal_ops',
        price_month_eur: 9,
        price_year_eur: 90,
        active: false,
      })!,
    ];
    assert.equal(quoteProFeaturesEur(['value_analytics', 'menu_dish_video'], products, 'month'), 15.5);
    assert.equal(quoteProFeaturesEur(['value_analytics', 'menu_dish_video'], products, 'year'), 155);
    assert.equal(quoteProFeaturesEur(['abnormal_ops'], products, 'month'), 0);
  });

  it('quoteRestaurantSubscriptionEur is base plus Pro add-ons', () => {
    const base = parseSubscriptionBaseProduct({
      price_month_eur: 29,
      price_year_eur: 290,
    })!;
    const products = [
      parseProFeatureProduct({
        feature_key: 'value_analytics',
        price_month_eur: 10,
        price_year_eur: 100,
        active: true,
      })!,
      parseProFeatureProduct({
        feature_key: 'menu_dish_video',
        price_month_eur: 5.5,
        price_year_eur: 55,
        active: true,
      })!,
    ];
    assert.equal(quoteSubscriptionBaseEur(base, 'month'), 29);
    assert.equal(quoteSubscriptionBaseEur(null, 'month'), 0);
    assert.equal(quoteRestaurantSubscriptionEur(base, [], products, 'month'), 29);
    assert.equal(
      quoteRestaurantSubscriptionEur(base, ['value_analytics', 'menu_dish_video'], products, 'month'),
      44.5,
    );
    assert.equal(
      quoteRestaurantSubscriptionEur(base, ['value_analytics', 'menu_dish_video'], products, 'year'),
      445,
    );
  });
});
