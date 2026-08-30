import { NextResponse } from 'next/server';
import { getFiscalSigningRestaurantStatus } from '@mesa/shared';
import { requirePlatformAdmin } from '@/lib/platform-auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { error, admin } = await requirePlatformAdmin();
  if (error || !admin) return error!;

  const { id: restaurantId } = await context.params;
  const status = await getFiscalSigningRestaurantStatus(admin, restaurantId);
  return NextResponse.json(status);
}
