import {
  lisbonCalendarDateFromInstant,
  todayLisbonCalendarDate,
} from '@mesa/shared';

/** Days remaining before license calendar end → “soon” urgency. */
export const LICENSE_RENEWAL_SOON_DAYS = 30;
/** Days remaining → “urgent” urgency. */
export const LICENSE_RENEWAL_URGENT_DAYS = 7;

export type LicenseValidUntilUrgency = 'normal' | 'soon' | 'urgent';

export type LicenseValidUntilDisplay = {
  ymd: string;
  daysRemaining: number;
  urgency: LicenseValidUntilUrgency;
};

function parseYmdUtcMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole Lisbon calendar days from `fromYmd` to `toYmd` (can be negative). */
export function lisbonCalendarDaysBetween(fromYmd: string, toYmd: string): number | null {
  const fromMs = parseYmdUtcMs(fromYmd);
  const toMs = parseYmdUtcMs(toYmd);
  if (fromMs == null || toMs == null) return null;
  return Math.round((toMs - fromMs) / 86_400_000);
}

export function licenseValidUntilUrgency(daysRemaining: number): LicenseValidUntilUrgency {
  if (daysRemaining <= LICENSE_RENEWAL_URGENT_DAYS) return 'urgent';
  if (daysRemaining <= LICENSE_RENEWAL_SOON_DAYS) return 'soon';
  return 'normal';
}

/**
 * Sole store-dashboard representation of an active license clock for chrome.
 * `null` valid-until → no display. Instant → Lisbon YMD (Ops end-of-day clock).
 */
export function resolveLicenseValidUntilDisplay(
  licenseValidUntil: string | null | undefined,
  now = new Date(),
): LicenseValidUntilDisplay | null {
  if (!licenseValidUntil) return null;
  const untilMs = Date.parse(licenseValidUntil);
  if (Number.isNaN(untilMs)) return null;

  const ymd = lisbonCalendarDateFromInstant(new Date(untilMs));
  const daysRemaining = lisbonCalendarDaysBetween(todayLisbonCalendarDate(now), ymd);
  if (daysRemaining == null) return null;

  return {
    ymd,
    daysRemaining,
    urgency: licenseValidUntilUrgency(daysRemaining),
  };
}

export function formatLicenseValidUntilYmd(ymd: string, locale: string): string {
  const ms = parseYmdUtcMs(ymd);
  if (ms == null) return ymd;
  return new Date(ms).toLocaleDateString(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const LICENSE_VALID_UNTIL_URGENCY_CLASS: Record<LicenseValidUntilUrgency, string> = {
  normal: 'text-brand-text-muted hover:text-brand-text',
  soon: 'font-medium text-amber-800 hover:text-amber-950',
  urgent: 'font-semibold text-red-700 hover:text-red-800',
};
