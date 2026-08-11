import {
  addCalendarDays,
  calendarDateInTimezone,
  daysBetweenInclusive,
  lisbonDayStartUtcIso,
} from '@/lib/lisbon-calendar';
import { resolveOperationLogRetentionDays } from '@/lib/operation-logs/retention-days';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type OperationLogsDateRange = {
  startDate: string;
  endDate: string;
};

export type ParsedOperationLogsDateRange =
  | {
      ok: true;
      startDate: string;
      endDate: string;
      startUtc: string;
      endExclusiveUtc: string;
    }
  | { ok: false; code: 'invalid_date_range' };

export function defaultOperationLogsDateRange(
  now: Date = new Date(),
  retentionDaysInput?: unknown,
): OperationLogsDateRange {
  const retentionDays = resolveOperationLogRetentionDays(retentionDaysInput);
  const today = calendarDateInTimezone(now);
  return {
    startDate: addCalendarDays(today, -(retentionDays - 1)),
    endDate: today,
  };
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

export function parseOperationLogsDateRange(input: {
  startDate?: string;
  endDate?: string;
  now?: Date;
  retentionDays?: unknown;
}): ParsedOperationLogsDateRange {
  const retentionDays = resolveOperationLogRetentionDays(input.retentionDays);
  const now = input.now ?? new Date();
  const today = calendarDateInTimezone(now);
  const defaults = defaultOperationLogsDateRange(now, retentionDays);
  const startDate = input.startDate?.trim() || defaults.startDate;
  const endDate = input.endDate?.trim() || defaults.endDate;

  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return { ok: false, code: 'invalid_date_range' };
  }
  if (endDate > today || startDate > endDate) {
    return { ok: false, code: 'invalid_date_range' };
  }
  if (daysBetweenInclusive(startDate, endDate) > retentionDays) {
    return { ok: false, code: 'invalid_date_range' };
  }

  const earliestAllowed = addCalendarDays(today, -(retentionDays - 1));
  if (startDate < earliestAllowed) {
    return { ok: false, code: 'invalid_date_range' };
  }

  const startUtc = lisbonDayStartUtcIso(startDate);
  const endExclusiveUtc = lisbonDayStartUtcIso(addCalendarDays(endDate, 1));
  return { ok: true, startDate, endDate, startUtc, endExclusiveUtc };
}
