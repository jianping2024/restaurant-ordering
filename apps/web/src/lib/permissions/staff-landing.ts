import type { SupabaseClient } from '@supabase/supabase-js';
import {
  STAFF_ROLE_COLUMNS,
  normalizeStaffRoleRow,
  resolveStaffRoleCapabilities,
} from '@/lib/permissions/restaurant-access-rules';
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
    .select(STAFF_ROLE_COLUMNS)
    .eq('id', account.role_id)
    .eq('restaurant_id', account.restaurant_id)
    .maybeSingle();

  return (
    resolveStaffRoleCapabilities(normalizeStaffRoleRow(role), account.restaurant_id)
      ?.capabilities ?? new Set()
  );
}
