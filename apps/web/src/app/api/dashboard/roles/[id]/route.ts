import { NextResponse } from 'next/server';
import { kickStaffUserSessions } from '@mesa/shared';
import { requirePermission } from '@/lib/permissions/require';
import {
  countStaffOnRole,
  deleteRestaurantRole,
  getRestaurantRole,
  listStaffUserIdsOnRole,
  updateRestaurantRole,
} from '@/lib/permissions/restaurant-roles';
import { enforcePermissionRequires, normalizeStoredPermissions } from '@/lib/permissions/resolve';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPermissionKey, type PermissionKey } from '@/lib/permissions/registry';
import { templatePermissions, isRolePresetKey } from '@/lib/permissions/role-templates';

export const runtime = 'nodejs';

async function bumpPermissionsVersion(
  admin: ReturnType<typeof createAdminClient>,
  restaurantId: string,
) {
  const { data } = await admin
    .from('restaurants')
    .select('permissions_version')
    .eq('id', restaurantId)
    .maybeSingle();
  const next = Number(data?.permissions_version ?? 0) + 1;
  await admin.from('restaurants').update({ permissions_version: next }).eq('id', restaurantId);
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requirePermission('settings.roles.manage');
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const role = await getRestaurantRole(admin, auth.principal.restaurantId, params.id);
  if (!role) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const staff_count = await countStaffOnRole(admin, auth.principal.restaurantId, role.id);
  return NextResponse.json({ role, staff_count });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requirePermission('settings.roles.manage');
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const admin = createAdminClient();
  const existing = await getRestaurantRole(admin, auth.principal.restaurantId, params.id);
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const patch: {
    name?: string;
    permissions?: PermissionKey[];
    disabled?: boolean;
  } = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });
    patch.name = name;
  }

  if (body.reset_to_template === true) {
    if (!existing.preset_key || !isRolePresetKey(existing.preset_key)) {
      return NextResponse.json({ error: 'not_a_preset' }, { status: 400 });
    }
    patch.permissions = templatePermissions(existing.preset_key);
  } else if (Array.isArray(body.permissions)) {
    patch.permissions = enforcePermissionRequires(
      normalizeStoredPermissions(
        body.permissions.filter((k): k is string => typeof k === 'string' && isPermissionKey(k)),
      ),
    );
  }

  if (body.disabled === true) patch.disabled = true;
  if (body.disabled === false) patch.disabled = false;

  try {
    const role = await updateRestaurantRole(
      admin,
      auth.principal.restaurantId,
      params.id,
      patch,
    );
    await bumpPermissionsVersion(admin, auth.principal.restaurantId);
    if (patch.permissions !== undefined) {
      const userIds = await listStaffUserIdsOnRole(admin, auth.principal.restaurantId, params.id);
      await Promise.all(userIds.map((userId) => kickStaffUserSessions(admin, userId)));
    }
    return NextResponse.json({ role });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'update_failed';
    if (message.includes('unique') || message.includes('duplicate')) {
      return NextResponse.json({ error: 'name_taken' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requirePermission('settings.roles.manage');
  if (auth instanceof NextResponse) return auth;

  try {
    const admin = createAdminClient();
    await deleteRestaurantRole(admin, auth.principal.restaurantId, params.id);
    await bumpPermissionsVersion(admin, auth.principal.restaurantId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'delete_failed';
    if (message === 'role_in_use') {
      return NextResponse.json({ error: 'role_in_use' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
