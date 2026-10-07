import { canAny, type Capabilities } from '@/lib/permissions/can';
import type { PermissionKey } from '@/lib/permissions/registry';
import { createClient } from '@/lib/supabase/server';

/** Capabilities that authorize staff-assisted checkout request (guest QR + staff). */
export const CHECKOUT_REQUEST_PERMISSIONS: readonly PermissionKey[] = [
  'checkout.request_whole_table',
  'checkout.assist_bill',
];

export type CheckoutRequestCaller =
  | { kind: 'customer' }
  | { kind: 'authorized_staff' }
  | { kind: 'forbidden_staff' };

/** Pure: staff session capabilities → assisted checkout caller kind. */
export function checkoutRequestCallerFromCapabilities(
  capabilities: Capabilities,
): 'authorized_staff' | 'forbidden_staff' {
  if (canAny(capabilities, CHECKOUT_REQUEST_PERMISSIONS)) {
    return 'authorized_staff';
  }
  return 'forbidden_staff';
}

/**
 * Who is calling checkout/request — customer QR flow vs staff-assisted vs blocked staff.
 * A guest phone always sends `guest_client_id` (staff-assisted never does): that request is a
 * customer even when this browser also holds a staff session (owner testing on their own phone).
 */
export async function resolveCheckoutRequestCaller(
  slug: string,
  opts?: { guestClientId?: unknown },
): Promise<CheckoutRequestCaller> {
  if (opts?.guestClientId != null) return { kind: 'customer' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: 'customer' };

  // Dynamic import keeps unit tests of pure helpers free of server-only staff-api-auth.
  const { staffSessionForSlug } = await import('@/lib/staff-api-auth');
  const ctx = await staffSessionForSlug(slug);
  if (!ctx) return { kind: 'customer' };

  return { kind: checkoutRequestCallerFromCapabilities(ctx.capabilities) };
}

export async function assertCheckoutRequestAllowed(
  slug: string,
  opts?: { guestClientId?: unknown },
): Promise<
  | { ok: true; caller: Exclude<CheckoutRequestCaller, { kind: 'forbidden_staff' }> }
  | { ok: false; error: string; status: number }
> {
  const caller = await resolveCheckoutRequestCaller(slug, opts);
  if (caller.kind === 'forbidden_staff') {
    return { ok: false, error: 'staff_checkout_request_forbidden', status: 403 };
  }
  return { ok: true, caller };
}
