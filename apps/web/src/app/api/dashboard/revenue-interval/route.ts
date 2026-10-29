import { NextResponse } from 'next/server';
import { getDashboardOperationalContext } from '@/lib/dashboard-access-cached';
import {
  loadDashboardRevenueIntervalTotal,
  parseDashboardRevenueIntervalDates,
} from '@/lib/analytics/revenue-interval';
import { isRestaurantFeatureEnabled } from '@mesa/shared';

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

  const [{ data: flagsRow }, result] = await Promise.all([
    ctx.admin.from('restaurants').select('feature_flags').eq('id', ctx.restaurantId).maybeSingle(),
    loadDashboardRevenueIntervalTotal({
      admin: ctx.admin,
      restaurantId: ctx.restaurantId,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      startUtc: parsed.startUtc,
      endExclusiveUtc: parsed.endExclusiveUtc,
      dateKeys: parsed.dateKeys,
    }),
  ]);

  if (!result.ok) {
    const status = result.code === 'query_limit_exceeded' ? 503 : 500;
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status },
    );
  }

  const takeawayOrderingEnabled = isRestaurantFeatureEnabled(
    flagsRow?.feature_flags,
    'takeaway_ordering',
  );

  return NextResponse.json({
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    revenueTotal: result.revenueTotal,
    takeawayOrderingEnabled,
    dineInRevenue: takeawayOrderingEnabled ? result.dineInRevenue : null,
    takeawayRevenue: takeawayOrderingEnabled ? result.takeawayRevenue : null,
  });
}
