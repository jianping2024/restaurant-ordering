import { NextResponse } from 'next/server';
import { kickStaffUserSessions, setStaffUserBanned } from '@mesa/shared';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import { loadOwnerRestaurantWithSlug, mapStaffRow } from '@/lib/staff-dashboard-api';

export const runtime = 'nodejs';

type RouteCtx = { params: { id: string } };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const loaded = await loadOwnerRestaurantWithSlug({ requireWritable: true });
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
    .eq('restaurant_id', loaded.restaurant.id)
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

  const action = body.action;

  if (action === 'disable') {
    const { data, error } = await loaded.admin
      .from('restaurant_staff_accounts')
      .update({ disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    await setStaffUserBanned(loaded.admin, existing.user_id as string, true);
    await kickStaffUserSessions(loaded.admin, existing.user_id as string);
    return NextResponse.json({ staff: mapStaffRow(data as Record<string, unknown>) });
  }

  if (action === 'enable') {
    const { data, error } = await loaded.admin
      .from('restaurant_staff_accounts')
      .update({ disabled_at: null, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('*')
      .single();
    if (error) {
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    await setStaffUserBanned(loaded.admin, existing.user_id as string, false);
    return NextResponse.json({ staff: mapStaffRow(data as Record<string, unknown>) });
  }

  const display_name = typeof body.display_name === 'string' ? body.display_name.trim() : '';
  if (!display_name) {
    return NextResponse.json({ error: 'display_name_required' }, { status: 400 });
  }

  const { data, error } = await loaded.admin
    .from('restaurant_staff_accounts')
    .update({ display_name, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ staff: mapStaffRow(data as Record<string, unknown>) });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const loaded = await loadOwnerRestaurantWithSlug({ requireWritable: true });
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { data: existing, error: loadError } = await loaded.admin
    .from('restaurant_staff_accounts')
    .select('user_id')
    .eq('id', params.id)
    .eq('restaurant_id', loaded.restaurant.id)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const userId = existing.user_id as string;

  const { error: delRowError } = await loaded.admin
    .from('restaurant_staff_accounts')
    .delete()
    .eq('id', params.id);

  if (delRowError) {
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  const { error: delUserError } = await loaded.admin.auth.admin.deleteUser(userId);
  if (delUserError) {
    return NextResponse.json({ error: 'delete_auth_failed', message: delUserError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
