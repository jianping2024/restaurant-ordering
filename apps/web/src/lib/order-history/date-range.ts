import {
  addCalendarDays,
  calendarDateInTimezone,
  daysBetweenInclusive,
} from '@/lib/lisbon-calendar';

/** Inclusive calendar-day cap for order-history list queries (matches abnormal-ops month window). */
export const ORDER_HISTORY_MAX_RANGE_DAYS = 31;

/** Default list window: today and the prior 6 calendar days (7 inclusive). */
export const ORDER_HISTORY_DEFAULT_RANGE_DAYS = 7;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type OrderHistoryClosedRange = {
  closedFrom: string;
  closedTo: string;
};

export type ParsedOrderHistoryClosedRange =
  | { ok: true; range: OrderHistoryClosedRange }
  | { ok: false; code: 'invalid_date_range' };

export function defaultOrderHistoryClosedRange(now: Date = new Date()): OrderHistoryClosedRange {
  const today = calendarDateInTimezone(now);
  return {
    closedFrom: addCalendarDays(today, -(ORDER_HISTORY_DEFAULT_RANGE_DAYS - 1)),
    closedTo: today,
  };
}

export function parseOrderHistoryClosedRange(input: {
  closedFrom?: string;
  closedTo?: string;
  /** When true (list browse), missing dates become the default last-7 window. */
  applyDefaultWhenMissing?: boolean;
  now?: Date;
}): ParsedOrderHistoryClosedRange {
  const fromRaw = input.closedFrom?.trim() || '';
  const toRaw = input.closedTo?.trim() || '';

  if (!fromRaw && !toRaw) {
    if (input.applyDefaultWhenMissing) {
      return { ok: true, range: defaultOrderHistoryClosedRange(input.now) };
    }
    return { ok: false, code: 'invalid_date_range' };
  }

  if (!DATE_RE.test(fromRaw) || !DATE_RE.test(toRaw)) {
    return { ok: false, code: 'invalid_date_range' };
  }
  if (fromRaw > toRaw) {
    return { ok: false, code: 'invalid_date_range' };
  }
  if (daysBetweenInclusive(fromRaw, toRaw) > ORDER_HISTORY_MAX_RANGE_DAYS) {
    return { ok: false, code: 'invalid_date_range' };
  }

  return { ok: true, range: { closedFrom: fromRaw, closedTo: toRaw } };
}

/** Local calendar day bounds for Postgres filters on `closed_at` / `occurred_at`. */
export function orderHistoryDayStartIso(dateKey: string): string {
  const date = new Date(dateKey);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function orderHistoryDayEndIso(dateKey: string): string {
  const date = new Date(dateKey);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export function formatOrderHistoryDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Clamp an inclusive picker range to ≤ ORDER_HISTORY_MAX_RANGE_DAYS. */
export function clampOrderHistoryPickerRange(range: {
  from?: Date;
  to?: Date;
}): { from: Date; to: Date } | null {
  if (!range.from) return null;
  const from = range.from;
  let to = range.to ?? range.from;
  const fromKey = formatOrderHistoryDateKey(from);
  let toKey = formatOrderHistoryDateKey(to);
  if (toKey < fromKey) {
    to = from;
    toKey = fromKey;
  }
  if (daysBetweenInclusive(fromKey, toKey) > ORDER_HISTORY_MAX_RANGE_DAYS) {
    const cappedToKey = addCalendarDays(fromKey, ORDER_HISTORY_MAX_RANGE_DAYS - 1);
    const [y, m, d] = cappedToKey.split('-').map(Number);
    to = new Date(y, m - 1, d);
  }
  return { from, to };
}

export function orderHistoryClosedRangeToPicker(range: OrderHistoryClosedRange): {
  from: Date;
  to: Date;
} {
  const [fy, fm, fd] = range.closedFrom.split('-').map(Number);
  const [ty, tm, td] = range.closedTo.split('-').map(Number);
  return {
    from: new Date(fy, fm - 1, fd),
    to: new Date(ty, tm - 1, td),
  };
}

export function formatOrderHistoryPickerFilter(range: {
  from?: Date;
  to?: Date;
}): OrderHistoryClosedRange | null {
  const clamped = clampOrderHistoryPickerRange(range);
  if (!clamped) return null;
  return {
    closedFrom: formatOrderHistoryDateKey(clamped.from),
    closedTo: formatOrderHistoryDateKey(clamped.to),
  };
}
