import { NextResponse } from 'next/server';
import { abnormalOperationsListRateLimitCheck } from '@/lib/abnormal-operations-rate-limit';
import { loadOperationLogsAccessContext } from '@/lib/operation-logs/load-access-context';
import { parseOperationLogsListQuery } from '@/lib/operation-logs/parse-list-query';
import { listOperationLogs } from '@/lib/operation-logs/query';
import { jsonForLoaderError } from '@/lib/premium/page-gate';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const ctx = await loadOperationLogsAccessContext();
  if ('error' in ctx) {
    return jsonForLoaderError(ctx);
  }

  const rate = abnormalOperationsListRateLimitCheck(ctx.userId, ctx.restaurantId);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_sec: rate.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  const filters = parseOperationLogsListQuery(new URL(req.url).searchParams, ctx.restaurantId);
  const result = await listOperationLogs(ctx.admin, {
    ...filters,
    retentionDays: ctx.retentionDays,
  });
  if (!result.ok) {
    const status = result.code === 'invalid_date_range' ? 400 : 500;
    return NextResponse.json({ error: result.code, message: result.message }, { status });
  }

  return NextResponse.json(result.result);
}
