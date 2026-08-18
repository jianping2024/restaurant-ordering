import { NextResponse } from 'next/server';
import { getDashboardOperationalContext } from '@/lib/dashboard-access-cached';
import {
  loadDashboardRevenueIntervalTotal,
  parseDashboardRevenueIntervalDates,
} from '@/lib/analytics/revenue-interval';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const ctx = await getDashboardOperationalContext('dashboard.overview.view');
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const url = new URL(req.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  const parsed = parseDashboardRevenueIntervalDates({ startDate, endDate, now: new Date() });
  if (!parsed.ok) {
    return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 });
  }

  const result = await loadDashboardRevenueIntervalTotal({
    admin: ctx.admin,
    restaurantId: ctx.restaurantId,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    startUtc: parsed.startUtc,
    endExclusiveUtc: parsed.endExclusiveUtc,
    dateKeys: parsed.dateKeys,
  });

  if (!result.ok) {
    const status = result.code === 'query_limit_exceeded' ? 503 : 500;
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status },
    );
  }

  return NextResponse.json({
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    revenueTotal: result.revenueTotal,
  });
}

