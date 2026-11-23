import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions/require';
import {
  countStaffOnRole,
  deleteRestaurantRole,
  getRestaurantRole,
  updateRestaurantRole,
} from '@/lib/permissions/restaurant-roles';
import {
  mergePreservedHiddenPermissions,
  permissionKeysHiddenWithoutPremium,
} from '@/lib/permissions/permission-premium-visibility';
import { normalizeRolePermissions } from '@/lib/permissions/role-permission-set';
import { loadRestaurantProEntitledKeys } from '@/lib/premium/access';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PermissionKey } from '@/lib/permissions/registry';
import { templatePermissions, isRolePresetKey } from '@/lib/permissions/role-templates';
import { requireStoreRestaurantId } from '@/lib/restaurant-api-store';

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
  { params }: { params: { slug: string; id: string } },
) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const auth = await requirePermission('settings.roles.manage', storeId);
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const role = await getRestaurantRole(admin, auth.restaurantId, params.id);
  if (!role) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const staff_count = await countStaffOnRole(admin, auth.restaurantId, role.id);
  return NextResponse.json({ role, staff_count });
}

export async function PATCH(
  req: Request,
  { params }: { params: { slug: string; id: string } },
) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const auth = await requirePermission('settings.roles.manage', storeId);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const admin = createAdminClient();
  const existing = await getRestaurantRole(admin, auth.restaurantId, params.id);
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
    const { data: restaurant } = await admin
      .from('restaurants')
      .select('plan, pro_valid_until, license_valid_until')
      .eq('id', auth.restaurantId)
      .maybeSingle();
    const entitledKeys = await loadRestaurantProEntitledKeys(auth.restaurantId);
    const hiddenKeys = new Set(
      permissionKeysHiddenWithoutPremium(restaurant ?? {}, entitledKeys),
    );
    patch.permissions = mergePreservedHiddenPermissions(
      normalizeRolePermissions(body.permissions),
      existing.permissions,
      hiddenKeys,
    );
  }

  if (body.disabled === true) patch.disabled = true;
  if (body.disabled === false) patch.disabled = false;

  try {
    const role = await updateRestaurantRole(
      admin,
      auth.restaurantId,
      params.id,
      patch,
    );
    // No session kick (plan §7): role capabilities are resolved per request; the account's
    // other stores must not be signed out.
    await bumpPermissionsVersion(admin, auth.restaurantId);
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
  { params }: { params: { slug: string; id: string } },
) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const auth = await requirePermission('settings.roles.manage', storeId);
  if (auth instanceof NextResponse) return auth;

  try {
    const admin = createAdminClient();
    await deleteRestaurantRole(admin, auth.restaurantId, params.id);
    await bumpPermissionsVersion(admin, auth.restaurantId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'delete_failed';
    if (message === 'role_in_use') {
      return NextResponse.json({ error: 'role_in_use' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
