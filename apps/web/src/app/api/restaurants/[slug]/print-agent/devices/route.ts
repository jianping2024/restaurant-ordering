import { NextResponse } from 'next/server';
import { getPrintAgentDevicesBundle } from '@/lib/print-agent-devices-bundle';
import { requireAnyPermission } from '@/lib/permissions/require';
import type { PermissionKey } from '@/lib/permissions/registry';
import { requireStoreRestaurantId } from '@/lib/restaurant-api-store';

export const runtime = 'nodejs';

const devicesReadPermissions = [
  'settings.print_assistant.manage',
  'print_agent.receipt_printers.read',
] as const satisfies readonly PermissionKey[];

/** Paired print agents + heartbeat fields (Dashboard / staff menu). */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const auth = await requireAnyPermission(devicesReadPermissions, storeId);
  if (auth instanceof NextResponse) return auth;

  const { devices } = await getPrintAgentDevicesBundle(auth.restaurantId);
  return NextResponse.json({ devices });
}
