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

/** Resolve landing path after server-side sign-in (owner before staff). */
export async function resolvePostLoginRedirect(
  supabase: SupabaseClient,
  userId: string,
  userMetadata: Record<string, unknown> | undefined,
): Promise<PostLoginRedirect> {
  const meta = parseStaffUserMetadata(userMetadata);

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

  const { data: account, error: staffError } = await supabase
    .from('restaurant_staff_accounts')
    .select('role, restaurant_id, disabled_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (staffError) {
    throw new Error(staffError.message);
  }

  if (!account) {
    if (meta?.account_type === 'staff') {
      return { kind: 'staff_error', code: 'incomplete' };
    }
    return { kind: 'onboarding', path: '/dashboard' };
  }

  if (account.disabled_at) {
    return { kind: 'staff_error', code: 'disabled' };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    throw new Error('server_misconfigured');
  }

  const { data: restaurantRow, error: suspendError } = await admin
    .from('restaurants')
    .select('suspended_at')
    .eq('id', account.restaurant_id)
    .maybeSingle();

  if (suspendError) {
    throw new Error(suspendError.message);
  }
  if (isRestaurantSuspended(restaurantRow?.suspended_at as string | null | undefined)) {
    return { kind: 'staff_error', code: 'restaurant_suspended' };
  }

  const roleRaw = String(account.role || meta?.staff_role || '');
  if (!isStaffRole(roleRaw)) {
    return { kind: 'staff_error', code: 'incomplete' };
  }

  let slug = meta?.restaurant_slug;
  if (!slug) {
    const { data: rest, error: slugError } = await supabase
      .from('restaurants_public')
      .select('slug')
      .eq('id', account.restaurant_id)
      .maybeSingle();
    if (slugError) {
      throw new Error(slugError.message);
    }
    slug = rest?.slug ?? undefined;
  }

  if (!slug) {
    return { kind: 'staff_error', code: 'incomplete' };
  }

  return {
    kind: 'staff',
    path: staffRolePath(slug, roleRaw),
    mustChangePassword: meta?.must_change_password === true,
    slug,
    role: roleRaw,
  };
}
