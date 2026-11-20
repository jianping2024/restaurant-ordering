import { NextResponse } from 'next/server';
import {
  isPrintAgentStaffRole,
  kickStaffUserSessions,
  loadStaffIdentity,
  setStaffMustChangePassword,
} from '@mesa/shared';
import {
  loadOwnerRestaurantWithSlug,
  mapStaffRow,
  staffMetadataPayload,
} from '@/lib/staff-dashboard-api';
import { accountPasswordPolicyError } from '@/lib/auth/account-password-policy';
import { requireStoreRestaurantId } from '@/lib/restaurant-api-store';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { slug: string; id: string } }) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const loaded = await loadOwnerRestaurantWithSlug(storeId, { requireWritable: true });
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

  const { data: account, error: loadError } = await loaded.admin
    .from('restaurant_staff_accounts')
    .select('*')
    .eq('id', params.id)
    .eq('restaurant_id', loaded.restaurantId)
    .maybeSingle();

  if (loadError || !account) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (isPrintAgentStaffRole(String(account.role ?? ''))) {
    return NextResponse.json({ error: 'system_account_locked' }, { status: 403 });
  }

  const userId = account.user_id as string;
  const identity = await loadStaffIdentity(loaded.admin, userId);
  const loginName = identity?.login_name ?? '';
  const passwordError = accountPasswordPolicyError(password, { loginName });
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const { error: updateError } = await loaded.admin.auth.admin.updateUserById(userId, {
    password,
    // Legacy mirror (rollback compatibility §5.4); the flag is read from staff_identities.
    user_metadata: staffMetadataPayload(
      account.id as string,
      loaded.restaurantId,
      loaded.restaurant.slug,
      String(account.role ?? ''),
      true,
    ),
  });

  if (updateError) {
    return NextResponse.json({ error: 'reset_failed', message: updateError.message }, { status: 500 });
  }

  try {
    await setStaffMustChangePassword(loaded.admin, userId, true);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'reset_failed', message }, { status: 500 });
  }

  await kickStaffUserSessions(loaded.admin, userId);

  await loaded.admin
    .from('restaurant_staff_accounts')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', params.id);

  return NextResponse.json({ staff: mapStaffRow(account as Record<string, unknown>, loginName) });
}
