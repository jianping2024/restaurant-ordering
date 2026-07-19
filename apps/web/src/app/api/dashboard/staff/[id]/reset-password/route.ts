import { NextResponse } from 'next/server';
import { isPrintAgentStaffRole, kickStaffUserSessions } from '@mesa/shared';
import {
  loadOwnerRestaurantWithSlug,
  mapStaffRow,
  staffMetadataPayload,
} from '@/lib/staff-dashboard-api';
import { staffPasswordValid } from '@/lib/staff-account';
import type { StaffRole } from '@/lib/staff-account';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const loaded = await loadOwnerRestaurantWithSlug({ requireWritable: true });
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!staffPasswordValid(password)) {
    return NextResponse.json({ error: 'password_too_short' }, { status: 400 });
  }

  const { data: account, error: loadError } = await loaded.admin
    .from('restaurant_staff_accounts')
    .select('*')
    .eq('id', params.id)
    .eq('restaurant_id', loaded.restaurant.id)
    .maybeSingle();

  if (loadError || !account) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (isPrintAgentStaffRole(String(account.role ?? ''))) {
    return NextResponse.json({ error: 'system_account_locked' }, { status: 403 });
  }

  const role = account.role as StaffRole;

  const { error: updateError } = await loaded.admin.auth.admin.updateUserById(account.user_id as string, {
    password,
    user_metadata: staffMetadataPayload(
      account.id as string,
      loaded.restaurant.id,
      loaded.restaurant.slug,
      role,
      true,
    ),
  });

  if (updateError) {
    return NextResponse.json({ error: 'reset_failed', message: updateError.message }, { status: 500 });
  }

  await kickStaffUserSessions(loaded.admin, account.user_id as string);

  await loaded.admin
    .from('restaurant_staff_accounts')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', params.id);

  return NextResponse.json({ staff: mapStaffRow(account as Record<string, unknown>) });
}
