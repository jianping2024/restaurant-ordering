import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isLicenseRenewalDailyPromptSeenToday,
  licenseRenewalDailyPromptValue,
  markLicenseRenewalDailyPromptSeen,
  parseLicenseRenewalDailyPromptValue,
  resolveLicenseRenewalDailyPromptOffer,
  shouldShowLicenseRenewalDailyPrompt,
} from './license-renewal-daily-prompt';
import { resolveLicenseValidUntilDisplay } from './license-valid-until-display';

describe('license-renewal-daily-prompt', () => {
  const store = new Map<string, string>();
  const originalLocalStorage = globalThis.localStorage;

  function installMemoryStorage() {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, String(v));
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
  }

  it('parses and formats seen values', () => {
    assert.equal(licenseRenewalDailyPromptValue('2026-12-31', '2026-12-25'), '2026-12-31|2026-12-25');
    assert.deepEqual(parseLicenseRenewalDailyPromptValue('2026-12-31|2026-12-25'), {
      licenseYmd: '2026-12-31',
      seenOnYmd: '2026-12-25',
    });
    assert.equal(parseLicenseRenewalDailyPromptValue('bad'), null);
  });

  it('offers urgent daily prompt once per Lisbon day until renewed', () => {
    installMemoryStorage();
    store.clear();
    const restaurantId = 'rest-1';
    const iso = '2026-08-15T22:59:59.999Z';
    const now = new Date('2026-08-10T12:00:00.000Z');
    const display = resolveLicenseValidUntilDisplay(iso, now);
    assert.ok(display);
    assert.equal(display.urgency, 'urgent');
    assert.equal(shouldShowLicenseRenewalDailyPrompt(restaurantId, display, now), true);
    assert.ok(resolveLicenseRenewalDailyPromptOffer(restaurantId, iso, now));

    markLicenseRenewalDailyPromptSeen(restaurantId, display.ymd, '2026-08-10');
    assert.equal(isLicenseRenewalDailyPromptSeenToday(restaurantId, display.ymd, now), true);
    assert.equal(shouldShowLicenseRenewalDailyPrompt(restaurantId, display, now), false);
    assert.equal(resolveLicenseRenewalDailyPromptOffer(restaurantId, iso, now), null);

    const nextDay = new Date('2026-08-11T12:00:00.000Z');
    assert.equal(shouldShowLicenseRenewalDailyPrompt(restaurantId, display, nextDay), true);

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it('does not offer daily prompt while urgency is soon/normal', () => {
    installMemoryStorage();
    store.clear();
    const soonIso = '2026-09-01T22:59:59.999Z';
    const now = new Date('2026-08-02T12:00:00.000Z');
    assert.equal(resolveLicenseRenewalDailyPromptOffer('rest-1', soonIso, now), null);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });
});
