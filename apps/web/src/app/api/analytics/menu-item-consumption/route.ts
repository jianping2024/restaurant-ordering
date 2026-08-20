import { NextResponse } from 'next/server';
import { analyticsMenuItemConsumptionRateLimitCheck } from '@/lib/analytics/analytics.rate-limit';
import { loadOwnerAnalyticsContext } from '@/lib/analytics/load-owner-analytics-context';
import { parseAnalyticsRange } from '@/lib/analytics/date-window';
import {
  getMenuItemConsumptionForRange,
  parseMenuItemConsumptionPageParams,
} from '@/lib/analytics/menu-item-consumption';
import { jsonForLoaderError } from '@/lib/premium/page-gate';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const ctx = await loadOwnerAnalyticsContext();
  if ('error' in ctx) {
    return jsonForLoaderError(ctx);
  }

  const rate = analyticsMenuItemConsumptionRateLimitCheck(ctx.userId, ctx.restaurantId);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_sec: rate.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  const url = new URL(req.url);
  const range = parseAnalyticsRange(url.searchParams.get('range'));
  if (!range) {
    return NextResponse.json({ error: 'invalid_range' }, { status: 400 });
  }

  const pageParams = parseMenuItemConsumptionPageParams({
    page: url.searchParams.get('page'),
    pageSize: url.searchParams.get('page_size'),
  });

  const result = await getMenuItemConsumptionForRange(
    ctx.admin,
    ctx.restaurantId,
    range,
    pageParams,
  );
  if (!result.ok) {
    const status = result.code === 'query_limit_exceeded' ? 503 : 500;
    return NextResponse.json(
      {
        error: result.code,
        message:
          result.code === 'query_limit_exceeded'
            ? '增值分析数据加载失败，请稍后重试'
            : result.message,
      },
      { status },
    );
  }

  return NextResponse.json(result.data);
}
