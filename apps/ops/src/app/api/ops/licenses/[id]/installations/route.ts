import { NextResponse } from 'next/server';
import { issueRestaurantInstallCode } from '@/lib/license-control';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id } = await context.params;
  const result = await issueRestaurantInstallCode(admin, {
    restaurantId: id,
    createdBy: ctx.userId,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'license.install_issue',
    targetType: 'restaurant_installation',
    targetId: result.installationId,
    restaurantId: id,
    metadata: { expiresAt: result.expiresAt },
  });

  return NextResponse.json({
    ok: true,
    installationId: result.installationId,
    code: result.code,
    expiresAt: result.expiresAt,
  });
}
