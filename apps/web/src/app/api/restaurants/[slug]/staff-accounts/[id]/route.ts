import { NextResponse } from 'next/server';
import { isPrintAgentStaffRole, loadStaffIdentity, removeStaffMembership } from '@mesa/shared';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import { getRestaurantRole, staffRoleLabelForRestaurantRole } from '@/lib/permissions/restaurant-roles';
import {
  loadOwnerRestaurantWithSlug,
  loadStaffAccountViews,
  staffMetadataPayload,
  validateStaffRoleChange,
} from '@/lib/staff-dashboard-api';
import { requireStoreRestaurantId } from '@/lib/restaurant-api-store';

export const runtime = 'nodejs';

type RouteCtx = { params: { slug: string; id: string } };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const loaded = await loadOwnerRestaurantWithSlug(storeId, { requireWritable: true });
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { data: existing, error: loadError } = await loaded.admin
    .from('restaurant_staff_accounts')
    .select('*')
    .eq('id', params.id)
    .eq('restaurant_id', loaded.restaurantId)
    .maybeSingle();

  if (loadError) {
    if (isDbMigrationRequiredError(loadError)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (isPrintAgentStaffRole(String(existing.role ?? ''))) {
    return NextResponse.json({ error: 'system_account_locked' }, { status: 403 });
  }

  const action = body.action;

  if (action === 'disable') {
    const { data, error } = await loaded.admin
      .from('restaurant_staff_accounts')
      .update({ disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('*, restaurant_roles(name)')
      .single();
    if (error) {
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    // Store-level only (plan §7): no Auth ban, no session kick — other stores stay usable;
    // this store refuses the account via `membershipIsEnterable`.
    return NextResponse.json({
      staff: (await loadStaffAccountViews(loaded.admin, [data as Record<string, unknown>]))[0],
    });
  }

  if (action === 'enable') {
    const { data, error } = await loaded.admin
      .from('restaurant_staff_accounts')
      .update({ disabled_at: null, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('*, restaurant_roles(name)')
      .single();
    if (error) {
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    return NextResponse.json({
      staff: (await loadStaffAccountViews(loaded.admin, [data as Record<string, unknown>]))[0],
    });
  }

  const display_name = typeof body.display_name === 'string' ? body.display_name.trim() : '';
  const roleChange = typeof body.role_id === 'string' ? validateStaffRoleChange(body) : null;

  if (!display_name && !roleChange) {
    return NextResponse.json({ error: 'display_name_required' }, { status: 400 });
  }
  if (roleChange && 'error' in roleChange) {
    return NextResponse.json({ error: roleChange.error }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (display_name) updates.display_name = display_name;

  if (roleChange && !('error' in roleChange)) {
    const roleRow = await getRestaurantRole(loaded.admin, loaded.restaurantId, roleChange.role_id);
    if (!roleRow || roleRow.disabled_at) {
      return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
    }
    updates.role_id = roleRow.id;
    updates.role = staffRoleLabelForRestaurantRole(roleRow);
  }

  const { data, error } = await loaded.admin
    .from('restaurant_staff_accounts')
    .update(updates)
    .eq('id', params.id)
    .select('*, restaurant_roles(name)')
    .single();

  if (error) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  if (roleChange && !('error' in roleChange)) {
    // Legacy mirror (rollback compatibility §5.4): role label + current forced-change flag.
    const identity = await loadStaffIdentity(loaded.admin, existing.user_id as string);
    await loaded.admin.auth.admin.updateUserById(existing.user_id as string, {
      user_metadata: staffMetadataPayload(
        data.id as string,
        loaded.restaurantId,
        loaded.restaurant.slug,
        String(data.role),
        identity?.must_change_password === true,
      ),
    });
    // No session kick (plan §7): capabilities are resolved from this store's row per request.
  }

  return NextResponse.json({
      staff: (await loadStaffAccountViews(loaded.admin, [data as Record<string, unknown>]))[0],
    });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const loaded = await loadOwnerRestaurantWithSlug(storeId, { requireWritable: true });
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { data: existing, error: loadError } = await loaded.admin
    .from('restaurant_staff_accounts')
    .select('user_id, role')
    .eq('id', params.id)
    .eq('restaurant_id', loaded.restaurantId)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (isPrintAgentStaffRole(String(existing.role ?? ''))) {
    return NextResponse.json({ error: 'system_account_locked' }, { status: 403 });
  }

  // Removes this store's membership only; retires the account when it was the last store.
  const removed = await removeStaffMembership(loaded.admin, {
    restaurantId: loaded.restaurantId,
    membershipId: params.id,
    userId: existing.user_id as string,
  });
  if (!removed.ok) {
    return NextResponse.json({ error: removed.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, account_retired: removed.accountRetired });
}
