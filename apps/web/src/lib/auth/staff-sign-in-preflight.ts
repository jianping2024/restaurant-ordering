import { isRestaurantSuspended } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';

export type StaffPreflightError = 'invalid_credentials' | 'restaurant_suspended';

export type StaffPreflightResult =
  | { ok: true }
  | { ok: false; code: StaffPreflightError };

/** Check staff account exists, is enabled, and restaurant is not suspended — before Supabase sign-in. */
export async function staffSignInPreflight(loginName: string): Promise<StaffPreflightResult> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    throw new Error('server_misconfigured');
  }

  const { data: account } = await admin
    .from('restaurant_staff_accounts')
    .select('id, disabled_at, restaurant_id')
    .eq('login_name', loginName)
    .maybeSingle();

  if (!account || account.disabled_at) {
    return { ok: false, code: 'invalid_credentials' };
  }

  const { data: restaurantRow } = await admin
    .from('restaurants')
    .select('suspended_at')
    .eq('id', account.restaurant_id as string)
    .maybeSingle();

  if (isRestaurantSuspended(restaurantRow?.suspended_at as string | null | undefined)) {
    return { ok: false, code: 'restaurant_suspended' };
  }

  return { ok: true };
}
