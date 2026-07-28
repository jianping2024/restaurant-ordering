import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions/require';
import {
  createRestaurantRole,
  listRestaurantRoles,
} from '@/lib/permissions/restaurant-roles';
import { enforcePermissionRequires, normalizeStoredPermissions } from '@/lib/permissions/resolve';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPermissionKey, type PermissionKey } from '@/lib/permissions/registry';

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

/** Owner has *; staff need settings.roles.manage (grantable). */
export async function GET() {
  const auth = await requirePermission('settings.roles.manage');
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const roles = await listRestaurantRoles(admin, auth.principal.restaurantId);
  return NextResponse.json({ roles });
}

export async function POST(req: Request) {
  const auth = await requirePermission('settings.roles.manage');
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

  const copyFromRoleId =
    typeof body.copy_from_role_id === 'string' ? body.copy_from_role_id : null;

  let permissions: PermissionKey[] = [];
  if (Array.isArray(body.permissions)) {
    permissions = enforcePermissionRequires(
      normalizeStoredPermissions(
        body.permissions.filter((k): k is string => typeof k === 'string' && isPermissionKey(k)),
      ),
    );
  }

  try {
    const admin = createAdminClient();
    const role = await createRestaurantRole(admin, auth.principal.restaurantId, {
      name,
      permissions,
      copyFromRoleId,
    });
    await bumpPermissionsVersion(admin, auth.principal.restaurantId);
    return NextResponse.json({ role }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'create_failed';
    if (message.includes('unique') || message.includes('duplicate')) {
      return NextResponse.json({ error: 'name_taken' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
