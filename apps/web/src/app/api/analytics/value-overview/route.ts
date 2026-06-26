import { NextResponse } from 'next/server';
import { getValueOverview } from '@/lib/analytics/analytics.service';
import { analyticsValueOverviewRateLimitCheck } from '@/lib/analytics/analytics.rate-limit';
import { loadOwnerAnalyticsContext } from '@/lib/analytics/load-owner-analytics-context';
import { parseAnalyticsRange } from '@/lib/analytics/date-window';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const ctx = await loadOwnerAnalyticsContext();
  if ('error' in ctx) {
    return NextResponse.json(
      { error: ctx.error, ...(ctx.message ? { message: ctx.message } : {}) },
      { status: ctx.status },
    );
  }

  const rate = analyticsValueOverviewRateLimitCheck(ctx.userId, ctx.restaurantId);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_sec: rate.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  const range = parseAnalyticsRange(new URL(req.url).searchParams.get('range'));
  if (!range) {
    return NextResponse.json({ error: 'invalid_range' }, { status: 400 });
  }

  const result = await getValueOverview(ctx.admin, ctx.restaurantId, range);
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
