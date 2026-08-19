import { auditMoney } from '@/lib/audit/money';
import {
  addCalendarDays,
  buildDateKeySeries,
  calendarDateInTimezone,
  lisbonDayStartUtcIso,
} from '@/lib/lisbon-calendar';
import {
  filterQualifyingClosedSessions,
  loadClosedSessionRevenueBundle,
  revenueTrendFromQualifying,
} from '@/lib/analytics/closed-session-revenue';
import type { SupabaseClient } from '@supabase/supabase-js';

export const DASHBOARD_REVENUE_INTERVAL_MAX_MONTHS = 12;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DashboardRevenueIntervalParseResult =
  | {
      ok: true;
      startDate: string;
      endDate: string;
      startUtc: string;
      endExclusiveUtc: string;
      dateKeys: string[];
    }
  | { ok: false; code: 'invalid_date_range' };

export function parseDashboardRevenueIntervalDates(input: {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  now?: Date;
  maxMonths?: number;
}): DashboardRevenueIntervalParseResult {
  const maxMonths = input.maxMonths ?? DASHBOARD_REVENUE_INTERVAL_MAX_MONTHS;
  const now = input.now ?? new Date();
  const today = calendarDateInTimezone(now);

  const startDate = input.startDate?.trim() ?? '';
  const endDate = input.endDate?.trim() ?? '';

  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) return { ok: false, code: 'invalid_date_range' };
  if (startDate > endDate) return { ok: false, code: 'invalid_date_range' };
  if (endDate > today) return { ok: false, code: 'invalid_date_range' };

  // Natural-month span check.
  // If maxMonths=12, then allowed month difference is at most 11 (inclusive).
  const monthIndex = (dateStr: string): number => {
    const [yearStr, monthStr] = dateStr.split('-');
    const year = Number(yearStr);
    const monthZeroBased = Number(monthStr) - 1;
    return year * 12 + monthZeroBased;
  };
  const startMonthIdx = monthIndex(startDate);
  const endMonthIdx = monthIndex(endDate);
  const monthsSpan = endMonthIdx - startMonthIdx;
  if (monthsSpan > maxMonths - 1) return { ok: false, code: 'invalid_date_range' };

  const startUtc = lisbonDayStartUtcIso(startDate);
  const endExclusiveUtc = lisbonDayStartUtcIso(addCalendarDays(endDate, 1));
  return {
    ok: true,
    startDate,
    endDate,
    startUtc,
    endExclusiveUtc,
    dateKeys: buildDateKeySeries(startDate, endDate),
  };
}

export async function loadDashboardRevenueIntervalTotal(params: {
  admin: SupabaseClient;
  restaurantId: string;
  startDate: string;
  endDate: string;
  startUtc: string;
  endExclusiveUtc: string;
  dateKeys: string[];
}): Promise<{ ok: true; revenueTotal: number } | { ok: false; code: string; message?: string }> {
  const { admin, restaurantId, startUtc, endExclusiveUtc, dateKeys } = params;

  const bundleResult = await loadClosedSessionRevenueBundle(admin, restaurantId, startUtc, endExclusiveUtc);
  if (!bundleResult.ok) return bundleResult;

  const qualifying = filterQualifyingClosedSessions(
    bundleResult.bundle.sessions,
    bundleResult.bundle.ordersBySession,
    bundleResult.bundle.splitsBySession,
  );

  const revenueTrend = revenueTrendFromQualifying(dateKeys, bundleResult.bundle, qualifying);
  const revenueTotal = auditMoney(revenueTrend.reduce((sum, p) => sum + p.revenue, 0));

  return { ok: true, revenueTotal };
}

