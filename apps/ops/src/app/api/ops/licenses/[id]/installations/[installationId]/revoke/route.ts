import { NextResponse } from 'next/server';
import { revokeRestaurantInstallation } from '@/lib/license-control';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string; installationId: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id, installationId } = await context.params;
  const result = await revokeRestaurantInstallation(admin, installationId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'license.install_revoke',
    targetType: 'restaurant_installation',
    targetId: installationId,
    restaurantId: id,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
