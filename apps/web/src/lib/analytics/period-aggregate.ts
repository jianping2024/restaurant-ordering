import type {
  AnalyticsRange,
  CustomerTrendPoint,
  RevenueTrendPoint,
} from '@/lib/analytics/analytics.types';
import { format, getISOWeek, getISOWeekYear, parseISO } from 'date-fns';

export type DailyMetricPoint = {
  date: string;
  revenue: number;
  adultCount: number;
  childCount: number;
  customerCount: number;
};

function lisbonDateAsUtcNoon(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function periodKeyForDay(dateStr: string, grain: AnalyticsRange): string {
  if (grain === 'day') return dateStr;

  const d = lisbonDateAsUtcNoon(dateStr);
  if (grain === 'week') {
    const weekYear = getISOWeekYear(d);
    const week = getISOWeek(d);
    return `${weekYear}-W${String(week).padStart(2, '0')}`;
  }
  if (grain === 'month') {
    return dateStr.slice(0, 7);
  }
  const month = Number(dateStr.slice(5, 7));
  const quarter = Math.ceil(month / 3);
  return `${dateStr.slice(0, 4)}-Q${quarter}`;
}

export function formatPeriodLabel(periodKey: string, grain: AnalyticsRange): string {
  if (grain === 'day') {
    return format(parseISO(periodKey), 'MM/dd');
  }
  if (grain === 'week') {
    const match = /^(\d{4})-W(\d{2})$/.exec(periodKey);
    return match ? `W${match[2]}` : periodKey;
  }
  if (grain === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
    return match ? `${match[2]}/${match[1].slice(2)}` : periodKey;
  }
  const q = /^(\d{4})-Q(\d)$/.exec(periodKey);
  return q ? `Q${q[2]}` : periodKey;
}

export function hasBusinessActivity(point: {
  revenue: number;
  customerCount: number;
}): boolean {
  return point.revenue > 0 || point.customerCount > 0;
}

/** Shared empty gate for API + client (one representation). */
export function isValueOverviewEmpty(data: {
  revenueTrend: Array<{ revenue: number }>;
  customerTrend: Array<{ customerCount: number }>;
}): boolean {
  if (data.revenueTrend.length === 0) return true;
  return !data.revenueTrend.some((point, index) =>
    hasBusinessActivity({
      revenue: point.revenue,
      customerCount: data.customerTrend[index]?.customerCount ?? 0,
    }),
  );
}

export function emptyValueOverviewTrends(): {
  revenueTrend: RevenueTrendPoint[];
  customerTrend: CustomerTrendPoint[];
} {
  return { revenueTrend: [], customerTrend: [] };
}

/** Aggregate daily points into grain periods (ordered by first-seen day). */
export function aggregateDailyPointsByGrain(
  days: DailyMetricPoint[],
  grain: AnalyticsRange,
): DailyMetricPoint[] {
  if (grain === 'day') {
    return days.map((day) => ({ ...day }));
  }

  const order: string[] = [];
  const buckets = new Map<string, DailyMetricPoint>();

  for (const day of days) {
    const key = periodKeyForDay(day.date, grain);
    const existing = buckets.get(key);
    if (!existing) {
      order.push(key);
      buckets.set(key, {
        date: key,
        revenue: day.revenue,
        adultCount: day.adultCount,
        childCount: day.childCount,
        customerCount: day.customerCount,
      });
      continue;
    }
    existing.revenue += day.revenue;
    existing.adultCount += day.adultCount;
    existing.childCount += day.childCount;
    existing.customerCount += day.customerCount;
  }

  return order.map((key) => buckets.get(key)!);
}

/** Drop leading periods with no activity (week/month/quarter). Day grain keeps full window. */
export function trimLeadingEmptyPeriods(
  points: DailyMetricPoint[],
  grain: AnalyticsRange,
): DailyMetricPoint[] {
  if (grain === 'day' || points.length === 0) return points;
  const firstIdx = points.findIndex((point) => hasBusinessActivity(point));
  if (firstIdx < 0) return [];
  return points.slice(firstIdx);
}

export function toTrendSeries(points: DailyMetricPoint[]): {
  revenueTrend: RevenueTrendPoint[];
  customerTrend: CustomerTrendPoint[];
} {
  return {
    revenueTrend: points.map((point) => ({ date: point.date, revenue: point.revenue })),
    customerTrend: points.map((point) => ({
      date: point.date,
      adultCount: point.adultCount,
      childCount: point.childCount,
      customerCount: point.customerCount,
    })),
  };
}
