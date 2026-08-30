import { NextResponse } from 'next/server';
import { activateFiscalSigning } from '@mesa/shared';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id: restaurantId } = await context.params;
  const result = await activateFiscalSigning(admin, {
    restaurantId,
    actorUserId: ctx.userId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'fiscal_signing.activate',
    targetType: 'fiscal_signing_installation',
    targetId: result.installation.id,
    restaurantId,
    metadata: {
      deviceId: result.installation.device_id,
      signingKeyVersion: result.installation.signing_key_version,
    },
  });

  return NextResponse.json({
    ok: true,
    installationId: result.installation.id,
    status: result.installation.status,
    deviceId: result.installation.device_id,
  });
}
