import {
  addCalendarDays,
  calendarDateInTimezone,
  daysBetweenInclusive,
  lisbonDayStartUtcIso,
} from '@/lib/lisbon-calendar';

/** Max inclusive calendar-day span for operation-log list queries. */
export const OPERATION_LOG_MAX_RANGE_DAYS = 7;

/** Max lookback from today for operation-log list queries (same 7-day retention window). */
export const OPERATION_LOG_MAX_LOOKBACK_DAYS = 7;

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

export function defaultOperationLogsDateRange(now: Date = new Date()): OperationLogsDateRange {
  const today = calendarDateInTimezone(now);
  return {
    startDate: addCalendarDays(today, -(OPERATION_LOG_MAX_RANGE_DAYS - 1)),
    endDate: today,
  };
}

/** UTC cutoff for rows older than the retained window (exclusive). */
export function operationLogRetentionCutoffUtcIso(now: Date = new Date()): string {
  const today = calendarDateInTimezone(now);
  const earliestKept = addCalendarDays(today, -(OPERATION_LOG_MAX_LOOKBACK_DAYS - 1));
  return lisbonDayStartUtcIso(earliestKept);
}

export function parseOperationLogsDateRange(input: {
  startDate?: string;
  endDate?: string;
  now?: Date;
}): ParsedOperationLogsDateRange {
  const now = input.now ?? new Date();
  const today = calendarDateInTimezone(now);
  const defaults = defaultOperationLogsDateRange(now);
  const startDate = input.startDate?.trim() || defaults.startDate;
  const endDate = input.endDate?.trim() || defaults.endDate;

  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return { ok: false, code: 'invalid_date_range' };
  }
  if (endDate > today || startDate > endDate) {
    return { ok: false, code: 'invalid_date_range' };
  }
  if (daysBetweenInclusive(startDate, endDate) > OPERATION_LOG_MAX_RANGE_DAYS) {
    return { ok: false, code: 'invalid_date_range' };
  }

  const earliestAllowed = addCalendarDays(today, -(OPERATION_LOG_MAX_LOOKBACK_DAYS - 1));
  if (startDate < earliestAllowed) {
    return { ok: false, code: 'invalid_date_range' };
  }

  const startUtc = lisbonDayStartUtcIso(startDate);
  const endExclusiveUtc = lisbonDayStartUtcIso(addCalendarDays(endDate, 1));
  return { ok: true, startDate, endDate, startUtc, endExclusiveUtc };
}
