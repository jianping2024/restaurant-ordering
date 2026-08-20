import {
  addCalendarDays,
  calendarDateInTimezone,
  lisbonDayStartUtcIso,
} from '@/lib/lisbon-calendar';
import { resolveOperationLogRetentionDays } from '@/lib/operation-logs/retention-days';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ParsedOperationLogsDay =
  | {
      ok: true;
      date: string;
      startUtc: string;
      endExclusiveUtc: string;
    }
  | { ok: false; code: 'invalid_date_range' };

/** Default list day: Lisbon today. */
export function defaultOperationLogsDay(now: Date = new Date()): string {
  return calendarDateInTimezone(now);
}

/** UTC cutoff for rows older than the retained window (exclusive). */
export function operationLogRetentionCutoffUtcIso(
  now: Date = new Date(),
  retentionDaysInput?: unknown,
): string {
  const retentionDays = resolveOperationLogRetentionDays(retentionDaysInput);
  const today = calendarDateInTimezone(now);
  const earliestKept = addCalendarDays(today, -(retentionDays - 1));
  return lisbonDayStartUtcIso(earliestKept);
}

/** Sole operation-logs list day parser: one Lisbon calendar day → UTC half-open window. */
export function parseOperationLogsDay(input: {
  date?: string;
  now?: Date;
  retentionDays?: unknown;
}): ParsedOperationLogsDay {
  const retentionDays = resolveOperationLogRetentionDays(input.retentionDays);
  const now = input.now ?? new Date();
  const today = calendarDateInTimezone(now);
  const date = input.date?.trim() || today;

  if (!DATE_RE.test(date)) {
    return { ok: false, code: 'invalid_date_range' };
  }
  if (date > today) {
    return { ok: false, code: 'invalid_date_range' };
  }

  const earliestAllowed = addCalendarDays(today, -(retentionDays - 1));
  if (date < earliestAllowed) {
    return { ok: false, code: 'invalid_date_range' };
  }

  const startUtc = lisbonDayStartUtcIso(date);
  const endExclusiveUtc = lisbonDayStartUtcIso(addCalendarDays(date, 1));
  return { ok: true, date, startUtc, endExclusiveUtc };
}
