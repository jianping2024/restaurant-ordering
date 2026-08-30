import { NextResponse } from 'next/server';
import { revokeFiscalSigning } from '@mesa/shared';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id: restaurantId } = await context.params;
  let installationId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.installationId === 'string' && body.installationId.trim()) {
      installationId = body.installationId.trim();
    }
  } catch {
    /* empty body ok */
  }

  const result = await revokeFiscalSigning(admin, {
    restaurantId,
    actorUserId: ctx.userId,
    installationId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'fiscal_signing.revoke',
    targetType: 'fiscal_signing_installation',
    targetId: result.installationId,
    restaurantId,
  });

  return NextResponse.json({ ok: true, installationId: result.installationId });
}
