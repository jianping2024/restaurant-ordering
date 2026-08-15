import { calendarDateInTimezone } from '@/lib/lisbon-calendar';

export type OrderHistoryClosedRange = {
  closedFrom: string;
  closedTo: string;
};

/**
 * Sole browse window for order-history list: Lisbon calendar today only.
 * List SSR / API / client reload all use this — no multi-day picker path.
 */
export function defaultOrderHistoryClosedRange(now: Date = new Date()): OrderHistoryClosedRange {
  const today = calendarDateInTimezone(now);
  return {
    closedFrom: today,
    closedTo: today,
  };
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
