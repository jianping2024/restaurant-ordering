import { NextResponse } from 'next/server';
import { revokePrintAgentDevice } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOwnerRestaurantId } from '@/lib/print-agent-dashboard-auth';

type RouteContext = { params: { id: string } };

/** Owner: revoke a paired print agent device (sets revoked_at). */
export async function POST(_req: Request, { params }: RouteContext) {
  const auth = await getOwnerRestaurantId({ requireWritable: true });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const deviceId = params.id?.trim();
  if (!deviceId) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const result = await revokePrintAgentDevice(admin, deviceId, auth.restaurantId);
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 500;
    return NextResponse.json({ error: result.error, detail: result.detail }, { status });
  }

  return NextResponse.json({ ok: true, id: result.deviceId });
}
