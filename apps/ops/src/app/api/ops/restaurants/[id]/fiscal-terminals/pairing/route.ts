import { NextResponse } from 'next/server';
import { createFiscalTerminalPairingCode } from '@mesa/shared';
import { requirePlatformAdminRole } from '@/lib/platform-auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id: restaurantId } = await context.params;
  const result = await createFiscalTerminalPairingCode(admin, {
    restaurantId,
    actorUserId: ctx.account.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, detail: result.detail }, { status: result.status });
  }

  return NextResponse.json({
    pairing_id: result.pairingId,
    code: result.code,
    expires_at: result.expiresAt,
  });
}
