/** Sole timezone for Ops license calendar days (end-of-day expiry). */
export const LICENSE_CALENDAR_TIMEZONE = 'Europe/Lisbon';

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLicenseCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !YMD_RE.test(value)) return false;
  return parseLicenseCalendarDate(value) != null;
}

export function parseLicenseCalendarDate(
  ymd: string,
): { y: number; m: number; d: number } | null {
  const match = YMD_RE.exec(ymd);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

function formatYmd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Lisbon civil date for an instant → `YYYY-MM-DD`. */
export function lisbonCalendarDateFromInstant(instant: Date): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: LICENSE_CALENDAR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(instant);
}

export function todayLisbonCalendarDate(now = new Date()): string {
  return lisbonCalendarDateFromInstant(now);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

/** Wall clock (whole seconds) in `timeZone` → UTC ms. */
function zonedWallSecondToUtcMs(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  ss: number,
  timeZone: string,
): number {
  let utcMs = Date.UTC(y, m - 1, d, hh, mm, ss);
  const offset1 = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
  utcMs = Date.UTC(y, m - 1, d, hh, mm, ss) - offset1;
  const offset2 = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
  if (offset2 !== offset1) {
    utcMs = Date.UTC(y, m - 1, d, hh, mm, ss) - offset2;
  }
  return utcMs;
}

/** `license_valid_until` for a Lisbon calendar day: that day 23:59:59.999 in Lisbon. */
export function licenseValidUntilEndOfLisbonDay(ymd: string): string {
  const parsed = parseLicenseCalendarDate(ymd);
  if (!parsed) throw new Error('invalid_license_calendar_date');
  const secondMs = zonedWallSecondToUtcMs(
    parsed.y,
    parsed.m,
    parsed.d,
    23,
    59,
    59,
    LICENSE_CALENDAR_TIMEZONE,
  );
  return new Date(secondMs + 999).toISOString();
}

export type ResolveLicenseCalendarDateResult =
  | { ok: true; ymd: string; licenseValidUntil: string }
  | { ok: false; error: 'invalid_license_date' | 'license_date_before_today' };

/** Validate YMD ≥ Lisbon today and normalize to end-of-day ISO. */
export function resolveLicenseCalendarDate(
  ymd: unknown,
  now = new Date(),
): ResolveLicenseCalendarDateResult {
  if (typeof ymd !== 'string' || !isLicenseCalendarDate(ymd)) {
    return { ok: false, error: 'invalid_license_date' };
  }
  if (ymd < todayLisbonCalendarDate(now)) {
    return { ok: false, error: 'license_date_before_today' };
  }
  return { ok: true, ymd, licenseValidUntil: licenseValidUntilEndOfLisbonDay(ymd) };
}

export type LicenseCalendarExtendPeriod = '1d' | '1m' | '1y';

/** Add whole calendar days on the Lisbon civil YMD (YMD arithmetic only). */
export function addLisbonCalendarDays(ymd: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error('invalid_lisbon_calendar_days');
  const parsed = parseLicenseCalendarDate(ymd);
  if (!parsed) throw new Error('invalid_license_calendar_date');
  const probe = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  probe.setUTCDate(probe.getUTCDate() + days);
  return formatYmd(probe.getUTCFullYear(), probe.getUTCMonth() + 1, probe.getUTCDate());
}

/** Add a period on the Lisbon civil calendar (YMD arithmetic only). */
export function addLisbonCalendarPeriod(
  ymd: string,
  period: LicenseCalendarExtendPeriod,
): string {
  const parsed = parseLicenseCalendarDate(ymd);
  if (!parsed) throw new Error('invalid_license_calendar_date');
  switch (period) {
    case '1d':
      return addLisbonCalendarDays(ymd, 1);
    case '1m': {
      const probe = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      probe.setUTCMonth(probe.getUTCMonth() + 1);
      return formatYmd(probe.getUTCFullYear(), probe.getUTCMonth() + 1, probe.getUTCDate());
    }
    case '1y': {
      const probe = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      probe.setUTCFullYear(probe.getUTCFullYear() + 1);
      return formatYmd(probe.getUTCFullYear(), probe.getUTCMonth() + 1, probe.getUTCDate());
    }
  }
}

/** ISO timestamptz → Lisbon `YYYY-MM-DD` for DatePicker value; empty when unset/invalid. */
export function lisbonCalendarDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  return lisbonCalendarDateFromInstant(new Date(ms));
}
