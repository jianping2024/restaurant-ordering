import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeStoredPermissions } from '@/lib/permissions/resolve';
import {
  ROLE_PRESET_DEFAULT_NAMES,
  ROLE_PRESET_KEYS,
  templatePermissions,
  type RolePresetKey,
} from '@/lib/permissions/role-templates';
import type { PermissionKey } from '@/lib/permissions/registry';
import type { RestaurantRoleRow } from '@/lib/permissions/types';

type Admin = SupabaseClient;

function mapRoleRow(raw: Record<string, unknown>): RestaurantRoleRow {
  return {
    id: String(raw.id),
    restaurant_id: String(raw.restaurant_id),
    name: String(raw.name),
    preset_key: (raw.preset_key as RolePresetKey | null) ?? null,
    permissions: normalizeStoredPermissions(raw.permissions),
    disabled_at: (raw.disabled_at as string | null) ?? null,
    sort_order: Number(raw.sort_order ?? 0),
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

/** Ensure four preset roles exist for a restaurant (idempotent). */
export async function ensureRestaurantPresetRoles(
  admin: Admin,
  restaurantId: string,
): Promise<void> {
  const { data: existing, error } = await admin
    .from('restaurant_roles')
    .select('preset_key')
    .eq('restaurant_id', restaurantId)
    .not('preset_key', 'is', null);

  if (error) throw new Error(error.message);

  const have = new Set(
    (existing ?? [])
      .map((r) => r.preset_key as string | null)
      .filter((k): k is string => Boolean(k)),
  );

  const inserts = ROLE_PRESET_KEYS.filter((key) => !have.has(key)).map((key, index) => ({
    restaurant_id: restaurantId,
    name: ROLE_PRESET_DEFAULT_NAMES[key],
    preset_key: key,
    permissions: templatePermissions(key),
    sort_order: index,
  }));

  if (inserts.length === 0) return;

  const { error: insertError } = await admin.from('restaurant_roles').insert(inserts);
  if (insertError) throw new Error(insertError.message);
}

export async function listRestaurantRoles(
  admin: Admin,
  restaurantId: string,
): Promise<RestaurantRoleRow[]> {
  await ensureRestaurantPresetRoles(admin, restaurantId);
  const { data, error } = await admin
    .from('restaurant_roles')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRoleRow(row as Record<string, unknown>));
}

export async function getRestaurantRole(
  admin: Admin,
  restaurantId: string,
  roleId: string,
): Promise<RestaurantRoleRow | null> {
  const { data, error } = await admin
    .from('restaurant_roles')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('id', roleId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRoleRow(data as Record<string, unknown>);
}

export async function findPresetRole(
  admin: Admin,
  restaurantId: string,
  presetKey: RolePresetKey,
): Promise<RestaurantRoleRow | null> {
  await ensureRestaurantPresetRoles(admin, restaurantId);
  const { data, error } = await admin
    .from('restaurant_roles')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('preset_key', presetKey)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRoleRow(data as Record<string, unknown>);
}

export type CreateRoleInput = {
  name: string;
  permissions: PermissionKey[];
  copyFromRoleId?: string | null;
};

export async function createRestaurantRole(
  admin: Admin,
  restaurantId: string,
  input: CreateRoleInput,
): Promise<RestaurantRoleRow> {
  let permissions = input.permissions;
  if (input.copyFromRoleId) {
    const source = await getRestaurantRole(admin, restaurantId, input.copyFromRoleId);
    if (!source) throw new Error('copy_source_not_found');
    permissions = source.permissions;
  }

  const { data: maxSort } = await admin
    .from('restaurant_roles')
    .select('sort_order')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = Number(maxSort?.sort_order ?? 0) + 1;

  const { data, error } = await admin
    .from('restaurant_roles')
    .insert({
      restaurant_id: restaurantId,
      name: input.name.trim(),
      preset_key: null,
      permissions,
      sort_order,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRoleRow(data as Record<string, unknown>);
}

export async function updateRestaurantRole(
  admin: Admin,
  restaurantId: string,
  roleId: string,
  patch: {
    name?: string;
    permissions?: PermissionKey[];
    disabled?: boolean;
  },
): Promise<RestaurantRoleRow> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.name === 'string') updates.name = patch.name.trim();
  if (patch.permissions) updates.permissions = patch.permissions;
  if (patch.disabled === true) updates.disabled_at = new Date().toISOString();
  if (patch.disabled === false) updates.disabled_at = null;

  const { data, error } = await admin
    .from('restaurant_roles')
    .update(updates)
    .eq('restaurant_id', restaurantId)
    .eq('id', roleId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRoleRow(data as Record<string, unknown>);
}

export async function countStaffOnRole(
  admin: Admin,
  restaurantId: string,
  roleId: string,
): Promise<number> {
  const { count, error } = await admin
    .from('restaurant_staff_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('role_id', roleId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listStaffUserIdsOnRole(
  admin: Admin,
  restaurantId: string,
  roleId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from('restaurant_staff_accounts')
    .select('user_id')
    .eq('restaurant_id', restaurantId)
    .eq('role_id', roleId);

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => row.user_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export async function deleteRestaurantRole(
  admin: Admin,
  restaurantId: string,
  roleId: string,
): Promise<void> {
  const occupied = await countStaffOnRole(admin, restaurantId, roleId);
  if (occupied > 0) throw new Error('role_in_use');

  const { error } = await admin
    .from('restaurant_roles')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('id', roleId);

  if (error) throw new Error(error.message);
}

/** Staff.role column value for RLS: preset key or `custom`. */
export function staffRoleLabelForRestaurantRole(role: Pick<RestaurantRoleRow, 'preset_key'>): string {
  return role.preset_key ?? 'custom';
}
