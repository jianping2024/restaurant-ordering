import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeStoredPermissions,
  resolveCapabilitiesFromRolePermissions,
  staffLandingPathFromCapabilities,
} from '@/lib/permissions/resolve';
import type { Capabilities } from '@/lib/permissions/can';

export type StaffGateCapabilitiesInput = {
  restaurant_id: string;
  role_id: string | null;
};

/** Load staff capabilities from role_id → restaurant_roles.permissions. */
export async function loadStaffCapabilitiesForGateAccount(
  admin: SupabaseClient,
  account: StaffGateCapabilitiesInput,
): Promise<Capabilities> {
  if (!account.role_id) return new Set();

  const { data: role } = await admin
    .from('restaurant_roles')
    .select('permissions, disabled_at')
    .eq('id', account.role_id)
    .eq('restaurant_id', account.restaurant_id)
    .maybeSingle();

  if (!role || role.disabled_at) return new Set();
  return resolveCapabilitiesFromRolePermissions(normalizeStoredPermissions(role.permissions));
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
