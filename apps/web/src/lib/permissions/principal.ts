import 'server-only';

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { staffRoleLabelForRestaurantRole } from '@/lib/permissions/restaurant-roles';
import { isRolePresetKey } from '@/lib/permissions/role-templates';
import { normalizeStoredPermissions } from '@/lib/permissions/resolve';
import type { Principal, StaffPrincipal } from '@/lib/permissions/types';
import {
  resolveCapabilitiesForOwner,
  resolveCapabilitiesFromRolePermissions,
} from '@/lib/permissions/resolve';
import type { Capabilities } from '@/lib/permissions/can';
import { loadAuthOwnershipGate } from '@/lib/staff-access';
import type { StaffGateAccount } from '@/lib/staff-identity-gate';

export type PrincipalWithCapabilities = {
  principal: Principal;
  capabilities: Capabilities;
};

async function loadStaffPrincipalFromGate(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  account: StaffGateAccount,
): Promise<PrincipalWithCapabilities | null> {
  if (account.disabled_at) return null;
  if (account.role === 'print_agent') return null;

  const roleId = account.role_id;
  if (!roleId) return null;

  const { data: role } = await admin
    .from('restaurant_roles')
    .select('id, name, preset_key, permissions, disabled_at')
    .eq('id', roleId)
    .eq('restaurant_id', account.restaurant_id)
    .maybeSingle();

  if (!role || role.disabled_at) return null;

  const roleName = String(role.name);
  const presetKey = isRolePresetKey(String(role.preset_key ?? ''))
    ? (role.preset_key as StaffPrincipal['presetKey'])
    : null;
  const permissions = normalizeStoredPermissions(role.permissions);

  const principal: StaffPrincipal = {
    kind: 'staff',
    restaurantId: account.restaurant_id,
    userId,
    staffAccountId: account.id,
    roleId,
    roleName,
    presetKey,
    staffRoleLabel: staffRoleLabelForRestaurantRole({ preset_key: presetKey }),
  };

  return {
    principal,
    capabilities: resolveCapabilitiesFromRolePermissions(permissions),
  };
}

/**
 * Request-scoped identity + capabilities.
 * Owner wins over staff row. Disabled role → null (cannot authenticate).
 * Auth user + ownership gate: sole via loadAuthOwnershipGate → loadAuthUserWithAdmin.
 */
export const loadPrincipalWithCapabilities = cache(
  async (): Promise<PrincipalWithCapabilities | null> => {
    const gate = await loadAuthOwnershipGate();
    if (!gate) return null;

    const { auth, ownedRestaurantId, staff } = gate;

    if (ownedRestaurantId) {
      return {
        principal: {
          kind: 'owner',
          restaurantId: ownedRestaurantId,
          userId: auth.user.id,
        },
        capabilities: resolveCapabilitiesForOwner(),
      };
    }

    if (!staff) return null;
    return loadStaffPrincipalFromGate(auth.admin, auth.user.id, staff);
  },
);

export async function loadPrincipal(): Promise<Principal | null> {
  const loaded = await loadPrincipalWithCapabilities();
  return loaded?.principal ?? null;
}
