import 'server-only';

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { staffRoleLabelForRestaurantRole } from '@/lib/permissions/restaurant-roles';
import { isRolePresetKey } from '@/lib/permissions/role-templates';
import { normalizeStoredPermissions } from '@/lib/permissions/resolve';
import type { Principal, StaffPrincipal } from '@/lib/permissions/types';
import {
  resolveCapabilitiesForOwner,
  resolveCapabilitiesFromRolePermissions,
} from '@/lib/permissions/resolve';
import type { Capabilities } from '@/lib/permissions/can';

export type PrincipalWithCapabilities = {
  principal: Principal;
  capabilities: Capabilities;
};

async function loadStaffPrincipal(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<PrincipalWithCapabilities | null> {
  const { data: account, error } = await admin
    .from('restaurant_staff_accounts')
    .select('id, restaurant_id, role, role_id, disabled_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !account || account.disabled_at) return null;
  if (account.role === 'print_agent') return null;

  const roleId = account.role_id as string | null;
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
    restaurantId: account.restaurant_id as string,
    userId,
    staffAccountId: account.id as string,
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
 */
export const loadPrincipalWithCapabilities = cache(
  async (): Promise<PrincipalWithCapabilities | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch {
      return null;
    }

    const { data: owned } = await admin
      .from('restaurants')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (owned?.id) {
      return {
        principal: {
          kind: 'owner',
          restaurantId: owned.id as string,
          userId: user.id,
        },
        capabilities: resolveCapabilitiesForOwner(),
      };
    }

    return loadStaffPrincipal(admin, user.id);
  },
);

export async function loadPrincipal(): Promise<Principal | null> {
  const loaded = await loadPrincipalWithCapabilities();
  return loaded?.principal ?? null;
}
