import type { SupabaseClient } from '@supabase/supabase-js';
import { findPresetRole } from '@/lib/permissions/restaurant-roles';
import { isRolePresetKey, type RolePresetKey } from '@/lib/permissions/role-templates';
import type { Capabilities } from '@/lib/permissions/can';
import {
  normalizeStoredPermissions,
  resolveCapabilitiesFromRolePermissions,
  staffLandingPathFromCapabilities,
} from '@/lib/permissions/resolve';

export type StaffGateCapabilitiesInput = {
  restaurant_id: string;
  role: string;
  role_id: string | null;
};

/** Load staff capabilities from gate row (role_id or legacy preset role column). */
export async function loadStaffCapabilitiesForGateAccount(
  admin: SupabaseClient,
  account: StaffGateCapabilitiesInput,
): Promise<Capabilities> {
  if (account.role_id) {
    const { data: role } = await admin
      .from('restaurant_roles')
      .select('permissions, disabled_at')
      .eq('id', account.role_id)
      .eq('restaurant_id', account.restaurant_id)
      .maybeSingle();

    if (!role || role.disabled_at) return new Set();
    return resolveCapabilitiesFromRolePermissions(normalizeStoredPermissions(role.permissions));
  }

  if (isRolePresetKey(account.role)) {
    const preset = await findPresetRole(
      admin,
      account.restaurant_id,
      account.role as RolePresetKey,
    );
    if (!preset || preset.disabled_at) return new Set();
    return resolveCapabilitiesFromRolePermissions(preset.permissions);
  }

  return new Set();
}

/** Staff post-login / change-password landing — capabilities only. */
export async function resolveStaffLandingPath(
  admin: SupabaseClient,
  account: StaffGateCapabilitiesInput,
  slug: string,
): Promise<string> {
  const capabilities = await loadStaffCapabilitiesForGateAccount(admin, account);
  return staffLandingPathFromCapabilities(slug, capabilities);
}
