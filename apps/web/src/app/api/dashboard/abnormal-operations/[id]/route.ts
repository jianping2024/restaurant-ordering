import { NextResponse } from 'next/server';
import {
  abnormalOperationsPatchRateLimitCheck,
} from '@/lib/abnormal-operations-rate-limit';
import { loadOwnerAbnormalOperationsContext } from '@/lib/abnormal-operations/load-owner-context';
import { patchAbnormalOperationWithAudit } from '@/lib/abnormal-operations/patch-abnormal-operation.service';
import type { AbnormalOperationStatus } from '@/lib/abnormal-operations/types';

export const runtime = 'nodejs';

const STATUSES = new Set<AbnormalOperationStatus>(['PENDING', 'CONFIRMED', 'IGNORED']);

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  const ctx = await loadOwnerAbnormalOperationsContext();
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const rate = abnormalOperationsPatchRateLimitCheck(ctx.userId, ctx.restaurantId);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_sec: rate.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  let body: { status?: unknown; owner_note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const statusRaw = typeof body.status === 'string' ? body.status.trim() : '';
  const status = statusRaw && STATUSES.has(statusRaw as AbnormalOperationStatus)
    ? (statusRaw as AbnormalOperationStatus)
    : undefined;

  const ownerNote =
    body.owner_note === null
      ? null
      : typeof body.owner_note === 'string'
        ? body.owner_note
        : undefined;

  if (status === undefined && ownerNote === undefined) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }

  const result = await patchAbnormalOperationWithAudit({
    admin: ctx.admin,
    restaurantId: ctx.restaurantId,
    ownerId: ctx.userId,
    actor: ctx.actor,
    id,
    status,
    ownerNote,
  });

  if (!result.ok) {
    const statusCode =
      result.code === 'not_found' ? 404 : result.code === 'invalid_status' ? 409 : 500;
    return NextResponse.json({ error: result.code, message: result.message }, { status: statusCode });
  }

  return NextResponse.json({ ok: true, row: result.row });
}
