import { auditMoney } from '@/lib/audit/money';
import {
  addCalendarDays,
  buildDateKeySeries,
  calendarDateInTimezone,
  daysBetweenInclusive,
  lisbonDayStartUtcIso,
} from '@/lib/lisbon-calendar';
import {
  filterQualifyingClosedSessions,
  loadClosedSessionRevenueBundle,
  revenueTrendFromQualifying,
} from '@/lib/analytics/closed-session-revenue';
import type { SupabaseClient } from '@supabase/supabase-js';

export const DASHBOARD_REVENUE_INTERVAL_MAX_DAYS = 31;

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
  maxDays?: number;
}): DashboardRevenueIntervalParseResult {
  const maxDays = input.maxDays ?? DASHBOARD_REVENUE_INTERVAL_MAX_DAYS;
  const now = input.now ?? new Date();
  const today = calendarDateInTimezone(now);

  const startDate = input.startDate?.trim() ?? '';
  const endDate = input.endDate?.trim() ?? '';

  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) return { ok: false, code: 'invalid_date_range' };
  if (startDate > endDate) return { ok: false, code: 'invalid_date_range' };
  if (endDate > today) return { ok: false, code: 'invalid_date_range' };

  // Inclusive span, so maxDays=31 means 31 natural days in [start,end]
  if (daysBetweenInclusive(startDate, endDate) > maxDays) return { ok: false, code: 'invalid_date_range' };

  const earliestAllowed = addCalendarDays(today, -(maxDays - 1));
  if (startDate < earliestAllowed) return { ok: false, code: 'invalid_date_range' };

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

