import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { StaffRole } from '@/lib/staff-account';

/** Staff roles that may initiate checkout on behalf of a table (assisted flow). */
export const CHECKOUT_REQUEST_AUTHORIZED_STAFF_ROLES: StaffRole[] = ['frontdesk', 'cashier'];

const CHECKOUT_REQUEST_FORBIDDEN_STAFF_ROLES: StaffRole[] = ['waiter', 'kitchen'];

export type CheckoutRequestCaller =
  | { kind: 'customer' }
  | { kind: 'authorized_staff' }
  | { kind: 'forbidden_staff' };

/** Who is calling checkout/request — customer QR flow vs staff-assisted vs blocked waiter. */
export async function resolveCheckoutRequestCaller(slug: string): Promise<CheckoutRequestCaller> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: 'customer' };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { kind: 'customer' };
  }

  const { data: asOwner } = await admin
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (asOwner) return { kind: 'authorized_staff' };

  const { data: account } = await admin
    .from('restaurant_staff_accounts')
    .select('restaurant_id, role, disabled_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!account || account.disabled_at) return { kind: 'customer' };

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('slug')
    .eq('id', account.restaurant_id as string)
    .maybeSingle();

  if (!restaurant || (restaurant.slug as string) !== slug) return { kind: 'customer' };

  const role = account.role as StaffRole;
  if (CHECKOUT_REQUEST_AUTHORIZED_STAFF_ROLES.includes(role)) {
    return { kind: 'authorized_staff' };
  }
  if (CHECKOUT_REQUEST_FORBIDDEN_STAFF_ROLES.includes(role)) {
    return { kind: 'forbidden_staff' };
  }
  return { kind: 'customer' };
}

export async function assertCheckoutRequestAllowed(
  slug: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const caller = await resolveCheckoutRequestCaller(slug);
  if (caller.kind === 'forbidden_staff') {
    return { ok: false, error: 'staff_checkout_request_forbidden', status: 403 };
  }
  return { ok: true };
}
