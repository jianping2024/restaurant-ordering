import type { SupabaseClient } from '@supabase/supabase-js';
import { loadStaffAuditActor } from '@/lib/audit';
import { loadOwnerDashboardAuditActor } from '@/lib/audit/load-owner-dashboard-actor';
import type { AuditActor } from '@/lib/audit/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { staffAuthFromRequestWithRoles, CHECKOUT_AUTHORIZED_STAFF_ROLES } from '@/lib/staff-api-auth';

export type CheckoutConfirmAuthContext =
  | {
      admin: SupabaseClient;
      restaurantId: string;
      printLocale: string | null;
      actor: AuditActor;
    }
  | { error: string; status: number };

export async function authorizeCheckoutConfirmPayment(
  slug: string,
  req: Request,
): Promise<CheckoutConfirmAuthContext> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'server_misconfigured', status: 503 };
  }

  const staffCtx = await staffAuthFromRequestWithRoles(req, slug, CHECKOUT_AUTHORIZED_STAFF_ROLES);
  if (staffCtx) {
    const { data: rest } = await admin
      .from('restaurants')
      .select('print_locale')
      .eq('id', staffCtx.restaurant_id)
      .single();
    const actor = await loadStaffAuditActor(admin, {
      restaurantId: staffCtx.restaurant_id,
      userId: staffCtx.user_id,
      role: staffCtx.role,
    });
    return {
      admin,
      restaurantId: staffCtx.restaurant_id,
      printLocale: rest?.print_locale ?? null,
      actor,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'unauthorized', status: 401 };
  }

  const { data: rest } = await admin
    .from('restaurants')
    .select('id, name, print_locale')
    .eq('slug', slug)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!rest) {
    return { error: 'unauthorized', status: 401 };
  }

  const ownerActor = await loadOwnerDashboardAuditActor({
    id: rest.id as string,
    name: (rest.name as string) || '',
  });
  if (!ownerActor) {
    return { error: 'unauthorized', status: 401 };
  }

  return {
    admin,
    restaurantId: rest.id as string,
    printLocale: rest.print_locale as string | null,
    actor: ownerActor.actor,
  };
}
