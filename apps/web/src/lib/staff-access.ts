import 'server-only';

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  deriveStaffLoginPreflight,
  type StaffLoginPreflightResult,
} from '@/lib/staff-identity-gate';
import { reconcileRestaurantLicense } from '@/lib/license-materialize';

export type {
  StaffLoginPreflightResult,
  StaffGateAccount,
  OwnerGateRestaurant,
} from '@/lib/staff-identity-gate';

export {
  deriveStaffLoginPreflight,
  deriveStaffLoginContext,
} from '@/lib/staff-identity-gate';

/**
 * Request-scoped getUser + admin for Node route handlers / RSC.
 * Not imported by Edge middleware (react.cache is unavailable there).
 */
export const loadAuthUserWithAdmin = cache(async (): Promise<{
  user: { id: string; user_metadata: Record<string, unknown> };
  admin: ReturnType<typeof createAdminClient>;
} | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    return {
      user: {
        id: user.id,
        user_metadata: (user.user_metadata as Record<string, unknown>) ?? {},
      },
      admin: createAdminClient(),
    };
  } catch {
    return null;
  }
});

/** Check staff account exists, is enabled, and restaurant is not suspended — before Supabase sign-in. */
export async function preflightStaffLogin(loginName: string): Promise<StaffLoginPreflightResult> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    throw new Error('server_misconfigured');
  }

  const { data, error } = await admin
    .from('restaurant_staff_accounts')
    .select(
      'id, disabled_at, role, role_id, restaurant_id, restaurant_roles!role_id(disabled_at)',
    )
    .eq('login_name', loginName)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return deriveStaffLoginPreflight({ account: null });
  }

  const restaurantId = data.restaurant_id as string | null;
  const suspension = restaurantId
    ? await reconcileRestaurantLicense(admin, restaurantId)
    : null;
  const roleEmbed = (
    data as { restaurant_roles?: { disabled_at?: string | null } | null }
  ).restaurant_roles;
  return deriveStaffLoginPreflight({
    account: {
      disabled_at: (data.disabled_at as string | null) ?? null,
      role: String(data.role ?? ''),
      role_id: (data.role_id as string | null) ?? null,
      restaurant_suspended_at: suspension?.suspended_at ?? null,
      suspension_reason: suspension?.suspension_reason ?? null,
      role_disabled_at: roleEmbed?.disabled_at ?? null,
    },
  });
}
