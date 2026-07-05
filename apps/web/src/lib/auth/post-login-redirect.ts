import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRestaurantSuspended } from '@mesa/shared';
import { staffRolePath } from '@/lib/staff-routes';
import { parseStaffUserMetadata, isStaffRole, type StaffRole } from '@/lib/staff-account';

export type PostLoginRedirect =
  | { kind: 'owner'; path: '/dashboard/settings' }
  | { kind: 'onboarding'; path: '/dashboard' }
  | { kind: 'staff'; path: string; mustChangePassword: boolean; slug: string; role: StaffRole }
  | { kind: 'staff_error'; code: 'disabled' | 'incomplete' | 'restaurant_suspended' };

type StaffLoginContext = {
  role: StaffRole;
  slug: string;
  mustChangePassword: boolean;
};

async function loadStaffLoginContext(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  userMetadata: Record<string, unknown> | undefined,
  options?: { skipSuspendCheck?: boolean },
): Promise<
  | { kind: 'staff'; context: StaffLoginContext }
  | { kind: 'staff_error'; code: 'disabled' | 'incomplete' | 'restaurant_suspended' }
  | { kind: 'onboarding' }
  | { kind: 'incomplete_staff_meta' }
> {
  const meta = parseStaffUserMetadata(userMetadata);

  const { data: account, error: staffError } = await admin
    .from('restaurant_staff_accounts')
    .select('role, restaurant_id, disabled_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (staffError) {
    throw new Error(staffError.message);
  }

  if (!account) {
    return meta?.account_type === 'staff'
      ? { kind: 'incomplete_staff_meta' }
      : { kind: 'onboarding' };
  }

  if (account.disabled_at) {
    return { kind: 'staff_error', code: 'disabled' };
  }

  const { data: restaurantRow, error: restaurantError } = await admin
    .from('restaurants')
    .select('slug, suspended_at')
    .eq('id', account.restaurant_id)
    .maybeSingle();

  if (restaurantError) {
    throw new Error(restaurantError.message);
  }

  if (
    !options?.skipSuspendCheck &&
    isRestaurantSuspended(restaurantRow?.suspended_at as string | null | undefined)
  ) {
    return { kind: 'staff_error', code: 'restaurant_suspended' };
  }

  const roleRaw = String(account.role || meta?.staff_role || '');
  if (!isStaffRole(roleRaw)) {
    return { kind: 'staff_error', code: 'incomplete' };
  }

  const slug = meta?.restaurant_slug ?? (restaurantRow?.slug as string | undefined);
  if (!slug) {
    return { kind: 'staff_error', code: 'incomplete' };
  }

  return {
    kind: 'staff',
    context: {
      role: roleRaw,
      slug,
      mustChangePassword: meta?.must_change_password === true,
    },
  };
}

/** Resolve landing path after server-side sign-in (owner before staff). */
export async function resolvePostLoginRedirect(
  supabase: SupabaseClient,
  userId: string,
  userMetadata: Record<string, unknown> | undefined,
  options?: { staffPreflightPassed?: boolean },
): Promise<PostLoginRedirect> {
  const { data: ownedRestaurant, error: ownerError } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();

  if (ownerError) {
    throw new Error(ownerError.message);
  }

  if (ownedRestaurant) {
    return { kind: 'owner', path: '/dashboard/settings' };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    throw new Error('server_misconfigured');
  }

  const staffResult = await loadStaffLoginContext(
    admin,
    userId,
    userMetadata,
    { skipSuspendCheck: options?.staffPreflightPassed === true },
  );

  if (staffResult.kind === 'onboarding') {
    return { kind: 'onboarding', path: '/dashboard' };
  }
  if (staffResult.kind === 'incomplete_staff_meta') {
    return { kind: 'staff_error', code: 'incomplete' };
  }
  if (staffResult.kind === 'staff_error') {
    return staffResult;
  }

  const { role, slug, mustChangePassword } = staffResult.context;

  return {
    kind: 'staff',
    path: staffRolePath(slug, role),
    mustChangePassword,
    slug,
    role,
  };
}
