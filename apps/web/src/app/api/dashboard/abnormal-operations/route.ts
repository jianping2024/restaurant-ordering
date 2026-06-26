import { NextResponse } from 'next/server';
import {
  abnormalOperationsListRateLimitCheck,
} from '@/lib/abnormal-operations-rate-limit';
import { loadOwnerAbnormalOperationsContext } from '@/lib/abnormal-operations/load-owner-context';
import { parseAbnormalOperationsListQuery } from '@/lib/abnormal-operations/parse-list-query';
import { listAbnormalOperations } from '@/lib/abnormal-operations/owner-query';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const ctx = await loadOwnerAbnormalOperationsContext();
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const rate = abnormalOperationsListRateLimitCheck(ctx.userId, ctx.restaurantId);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_sec: rate.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  const filters = parseAbnormalOperationsListQuery(new URL(req.url).searchParams, ctx.restaurantId);
  const result = await listAbnormalOperations(ctx.admin, filters);
  if (!result.ok) {
    const status = result.code === 'invalid_date_range' ? 400 : 500;
    return NextResponse.json({ error: result.code, message: result.message }, { status });
  }

  return NextResponse.json(result.result);
}
