import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canUsePremiumFeature,
  isProEffective,
  normalizePremiumKeys,
  proTrialValidUntil,
  PRO_TRIAL_DAYS,
} from './premium-tier';
import {
  addLisbonCalendarDays,
  licenseValidUntilEndOfLisbonDay,
  lisbonCalendarDateFromInstant,
} from './license-calendar';

describe('premium-tier', () => {
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

  it('canUsePremiumFeature skips gate when key not in catalog', () => {
    assert.equal(
      canUsePremiumFeature({
        premiumKey: 'value_analytics',
        enabledKeys: ['abnormal_ops'],
        plan: 'basic',
        proValidUntil: null,
        licenseValidUntil: null,
      }),
      true,
    );
  });

  it('normalizePremiumKeys allows empty catalog; falls back when missing/invalid', () => {
    assert.deepEqual(normalizePremiumKeys(null), [
      'value_analytics',
      'abnormal_ops',
      'operation_logs',
    ]);
    assert.deepEqual(normalizePremiumKeys([]), []);
    assert.deepEqual(normalizePremiumKeys(['value_analytics']), ['value_analytics']);
    assert.deepEqual(normalizePremiumKeys(['not_a_key']), [
      'value_analytics',
      'abnormal_ops',
      'operation_logs',
    ]);
  });
});
