import 'server-only';

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { OwnerGateRestaurant, StaffGateAccount } from '@/lib/staff-identity-gate';
import {
  loadOwnerRestaurantForUser,
  loadStaffGateAccountForUser,
} from '@/lib/staff-gate-db';

export type { StaffGateAccount, OwnerGateRestaurant } from '@/lib/staff-identity-gate';

export type AuthUserWithAdmin = {
  user: {
    id: string;
    email: string | null;
    user_metadata: Record<string, unknown>;
  };
  admin: ReturnType<typeof createAdminClient>;
};

/**
 * Request-scoped getUser + admin for Node route handlers / RSC.
 * Sole RSC/auth-user bootstrap — do not call createClient().auth.getUser() beside this
 * in dashboard layout consumers. Not imported by Edge middleware (react.cache unavailable).
 */
export const loadAuthUserWithAdmin = cache(async (): Promise<AuthUserWithAdmin | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    return {
      user: {
        id: user.id,
        email: user.email ?? null,
        user_metadata: (user.user_metadata as Record<string, unknown>) ?? {},
      },
      admin: createAdminClient(),
    };
  } catch {
    return null;
  }
});

/**
 * Request-scoped owner id + staff gate for the current auth user.
 * Dedupes the parallel lookups shared by dashboard access + principal.
 * ownedRestaurantId = sole owner restaurant (`owner_id` or on-prem shadow after claim).
 */
export const loadAuthOwnershipGate = cache(async (): Promise<{
  auth: AuthUserWithAdmin;
  ownedRestaurantId: string | null;
  ownedRestaurant: OwnerGateRestaurant | null;
  staff: StaffGateAccount | null;
} | null> => {
  const auth = await loadAuthUserWithAdmin();
  if (!auth) return null;
  const [ownedRestaurant, staff] = await Promise.all([
    loadOwnerRestaurantForUser(auth.admin, {
      userId: auth.user.id,
      email: auth.user.email,
      userMetadata: auth.user.user_metadata,
    }),
    loadStaffGateAccountForUser(auth.admin, auth.user.id),
  ]);
  return { auth, ownedRestaurantId: ownedRestaurant?.id ?? null, ownedRestaurant, staff };
});
