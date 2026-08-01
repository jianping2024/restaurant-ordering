import { NextResponse } from 'next/server';
import { getPrintAgentDevicesBundle } from '@/lib/print-agent-devices-bundle';
import { requireAnyPermission } from '@/lib/permissions/require';
import type { PermissionKey } from '@/lib/permissions/registry';

export const runtime = 'nodejs';

const devicesReadPermissions = [
  'settings.print_assistant.manage',
  'print_agent.receipt_printers.read',
] as const satisfies readonly PermissionKey[];

/** Paired print agents + heartbeat fields (Dashboard / staff menu). */
export async function GET() {
  const auth = await requireAnyPermission(devicesReadPermissions);
  if (auth instanceof NextResponse) return auth;

  const { devices } = await getPrintAgentDevicesBundle(auth.principal.restaurantId);
  return NextResponse.json({ devices });
}
