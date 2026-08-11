import { todayLisbonCalendarDate } from '@mesa/shared';
import {
  resolveLicenseValidUntilDisplay,
  type LicenseValidUntilDisplay,
} from './license-valid-until-display';

const KEY_PREFIX = 'mesa-license-renewal-daily:';

export function licenseRenewalDailyPromptStorageKey(restaurantId: string): string {
  return `${KEY_PREFIX}${restaurantId}`;
}

/** Value: `${licenseYmd}|${seenOnLisbonYmd}` — renewing the license invalidates the snooze. */
export function licenseRenewalDailyPromptValue(licenseYmd: string, seenOnYmd: string): string {
  return `${licenseYmd}|${seenOnYmd}`;
}

export function parseLicenseRenewalDailyPromptValue(
  raw: string | null,
): { licenseYmd: string; seenOnYmd: string } | null {
  if (!raw) return null;
  const idx = raw.indexOf('|');
  if (idx <= 0 || idx === raw.length - 1) return null;
  return {
    licenseYmd: raw.slice(0, idx),
    seenOnYmd: raw.slice(idx + 1),
  };
}

export function readLicenseRenewalDailyPromptSeen(restaurantId: string): string | null {
  if (typeof globalThis.localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(licenseRenewalDailyPromptStorageKey(restaurantId));
  } catch {
    return null;
  }
}

export function markLicenseRenewalDailyPromptSeen(
  restaurantId: string,
  licenseYmd: string,
  seenOnYmd = todayLisbonCalendarDate(),
): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      licenseRenewalDailyPromptStorageKey(restaurantId),
      licenseRenewalDailyPromptValue(licenseYmd, seenOnYmd),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function isLicenseRenewalDailyPromptSeenToday(
  restaurantId: string,
  licenseYmd: string,
  now = new Date(),
): boolean {
  const parsed = parseLicenseRenewalDailyPromptValue(
    readLicenseRenewalDailyPromptSeen(restaurantId),
  );
  if (!parsed) return false;
  if (parsed.licenseYmd !== licenseYmd) return false;
  return parsed.seenOnYmd === todayLisbonCalendarDate(now);
}

/**
 * Sole gate for the once-per-Lisbon-day urgent renewal dialog.
 * Manual top-bar / menu opens do not use this gate.
 */
export function shouldShowLicenseRenewalDailyPrompt(
  restaurantId: string,
  display: LicenseValidUntilDisplay | null,
  now = new Date(),
): boolean {
  if (!display || display.urgency !== 'urgent') return false;
  return !isLicenseRenewalDailyPromptSeenToday(restaurantId, display.ymd, now);
}

export function resolveLicenseRenewalDailyPromptOffer(
  restaurantId: string,
  licenseValidUntil: string | null | undefined,
  now = new Date(),
): LicenseValidUntilDisplay | null {
  const display = resolveLicenseValidUntilDisplay(licenseValidUntil, now);
  if (!shouldShowLicenseRenewalDailyPrompt(restaurantId, display, now)) return null;
  return display;
}
