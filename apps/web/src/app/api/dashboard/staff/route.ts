import { NextResponse } from 'next/server';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import { buildStaffEmail } from '@/lib/staff-account';
import {
  listHumanStaffAccountsForRestaurant,
  mapStaffRow,
  staffMetadataPayload,
  validateStaffCreateBody,
} from '@/lib/staff-dashboard-api';
import { findPresetRole, getRestaurantRole, staffRoleLabelForRestaurantRole } from '@/lib/permissions/restaurant-roles';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/permissions/require';
import type { PermissionKey } from '@/lib/permissions/registry';
import { isRestaurantSuspended } from '@mesa/shared';

export const runtime = 'nodejs';

export async function GET() {
  const permission: PermissionKey = 'settings.staff.manage';
  const auth = await requirePermission(permission);
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const { staff, error } = await listHumanStaffAccountsForRestaurant(admin, auth.principal.restaurantId);

  if (error) {
    if (isDbMigrationRequiredError(error)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff });
}

export async function POST(req: Request) {
  const permission: PermissionKey = 'settings.staff.manage';
  const auth = await requirePermission(permission);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = validateStaffCreateBody(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const email = buildStaffEmail(parsed.login_name);

  const admin = createAdminClient();
  const { data: restaurant, error: restErr } = await admin
    .from('restaurants')
    .select('id, name, slug, suspended_at')
    .eq('id', auth.principal.restaurantId)
    .maybeSingle();
  if (restErr || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
  }
  if (isRestaurantSuspended(restaurant.suspended_at)) {
    return NextResponse.json({ error: 'restaurant_suspended' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user: actor } } = await supabase.auth.getUser();

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: {
      account_type: 'staff',
      must_change_password: true,
      staff_role: parsed.role,
      restaurant_id: restaurant.id,
      restaurant_slug: restaurant.slug,
    },
  });

  if (createError) {
    const msg = createError.message.toLowerCase();
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return NextResponse.json({ error: 'login_name_taken' }, { status: 409 });
    }
    return NextResponse.json({ error: 'create_user_failed', message: createError.message }, { status: 500 });
  }

  const userId = createdUser.user.id;

  const presetRole = parsed.role_id
    ? await getRestaurantRole(admin, restaurant.id, parsed.role_id)
    : await findPresetRole(admin, restaurant.id, parsed.role);

  if (!presetRole) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  }

  const staffRoleLabel = staffRoleLabelForRestaurantRole(presetRole);

  const { data: row, error: insertError } = await admin
    .from('restaurant_staff_accounts')
    .insert({
      restaurant_id: restaurant.id,
      user_id: userId,
      role: staffRoleLabel,
      role_id: presetRole.id,
      display_name: parsed.display_name,
      login_name: parsed.login_name,
      created_by: actor?.id ?? null,
    })
    .select('*')
    .single();

  if (insertError) {
    await admin.auth.admin.deleteUser(userId);
    if (isDbMigrationRequiredError(insertError)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'login_name_taken' }, { status: 409 });
    }
    return NextResponse.json({ error: 'insert_failed', message: insertError.message }, { status: 500 });
  }

  const account = mapStaffRow(row as Record<string, unknown>);
  await admin.auth.admin.updateUserById(userId, {
    user_metadata: staffMetadataPayload(
      account.id,
      restaurant.id,
      restaurant.slug,
      staffRoleLabel,
      true,
    ),
  });

  return NextResponse.json({ staff: account }, { status: 201 });
}
