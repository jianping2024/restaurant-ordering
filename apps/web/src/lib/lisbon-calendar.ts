import { DASHBOARD_DISPLAY_TZ } from '@/lib/format-dashboard-date';
import { getZonedCalendarParts } from '@/lib/zoned-time';

export function calendarDateInTimezone(date: Date, timeZone = DASHBOARD_DISPLAY_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function addCalendarDays(dateStr: string, delta: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return utc.toISOString().slice(0, 10);
}

export function daysBetweenInclusive(start: string, end: string): number {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  const startMs = Date.UTC(ys, ms - 1, ds);
  const endMs = Date.UTC(ye, me - 1, de);
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

export function lisbonDayStartUtcIso(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const baseMs = Date.UTC(year, month - 1, day - 2, 0, 0, 0);
  let previousDate = '';
  for (let offsetHours = 0; offsetHours < 96; offsetHours += 1) {
    const candidate = new Date(baseMs + offsetHours * 3_600_000);
    const currentDate = calendarDateInTimezone(candidate);
    if (currentDate === dateStr && previousDate !== dateStr) {
      return candidate.toISOString();
    }
    previousDate = currentDate;
  }
  throw new Error(`lisbon_day_start_not_found:${dateStr}`);
}

/**
 * First UTC instant on `dateStr` (Lisbon calendar) at which local clock is ≥ `hhmm` (HH:MM).
 * Used as exclusive end of “noon” / inclusive start of “evening” for overview dayparts.
 */
export function lisbonLocalClockUtcIso(dateStr: string, hhmm: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) throw new Error(`invalid_lisbon_clock:${hhmm}`);
  const targetMins = Number(match[1]) * 60 + Number(match[2]);
  if (targetMins < 0 || targetMins >= 24 * 60) throw new Error(`invalid_lisbon_clock:${hhmm}`);

  const startMs = Date.parse(lisbonDayStartUtcIso(dateStr));
  const endMs = Date.parse(lisbonDayStartUtcIso(addCalendarDays(dateStr, 1)));
  let lo = startMs;
  let hi = endMs;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const parts = getZonedCalendarParts(new Date(mid), DASHBOARD_DISPLAY_TZ);
    const mins = parts.hour * 60 + parts.minute;
    const before =
      parts.dateKey < dateStr || (parts.dateKey === dateStr && mins < targetMins);
    if (before) lo = mid + 1;
    else hi = mid;
  }
  return new Date(lo).toISOString();
}

export function buildDateKeySeries(startDate: string, endDate: string): string[] {
  const keys: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    keys.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return keys;
}

export function sessionDateKeyFromIso(iso: string): string {
  return calendarDateInTimezone(new Date(iso));
}

export function isIsoInWindow(iso: string, startUtc: string, endExclusiveUtc: string): boolean {
  return iso >= startUtc && iso < endExclusiveUtc;
}
