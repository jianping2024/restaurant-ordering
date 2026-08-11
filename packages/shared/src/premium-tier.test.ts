import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canUsePremiumFeature,
  extendProValidUntil,
  isProEffective,
  normalizePremiumKeys,
  proTrialValidUntil,
  PRO_TRIAL_DAYS,
} from './premium-tier';

describe('premium-tier', () => {
  it('proTrialValidUntil adds PRO_TRIAL_DAYS', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const until = proTrialValidUntil(from);
    const expected = new Date(from);
    expected.setUTCDate(expected.getUTCDate() + PRO_TRIAL_DAYS);
    assert.equal(until, expected.toISOString());
  });

  it('extendProValidUntil stacks from expiry when still active', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const current = '2026-12-01T00:00:00.000Z';
    const next = extendProValidUntil(current, 30, now);
    assert.equal(next, '2026-12-31T00:00:00.000Z');
  });

  it('extendProValidUntil starts from now when expired', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const current = '2026-01-01T00:00:00.000Z';
    const next = extendProValidUntil(current, 30, now);
    assert.equal(next, '2026-07-01T00:00:00.000Z');
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

  it('normalizePremiumKeys falls back to defaults', () => {
    assert.deepEqual(normalizePremiumKeys(null), [
      'value_analytics',
      'abnormal_ops',
      'operation_logs',
    ]);
    assert.deepEqual(normalizePremiumKeys(['value_analytics']), ['value_analytics']);
  });
});
