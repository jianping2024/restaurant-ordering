import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { StaffRole } from '@/lib/staff-account';

export type StaffAuthContext = {
  restaurant_id: string;
  slug: string;
  role: StaffRole;
  user_id: string;
};

export type StaffAuthLoadError = 'migration_required' | 'restaurant_not_found' | 'server_misconfigured';

export function staffAuthErrorStatus(error: StaffAuthLoadError): number {
  if (error === 'migration_required') return 503;
  if (error === 'restaurant_not_found') return 404;
  return 503;
}

export async function loadRestaurantBySlug(slug: string) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'server_misconfigured' as const };
  }

  const { data: restaurant, error } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    if (isDbMigrationRequiredError(error)) {
      return { error: 'migration_required' as const };
    }
    return { error: 'restaurant_not_found' as const };
  }
  if (!restaurant) {
    return { error: 'restaurant_not_found' as const };
  }

  return { admin, restaurant: restaurant as { id: string; slug: string } };
}

/** Validates Supabase Auth session + staff account row for slug/role. */
export async function staffAuthFromRequest(
  req: Request,
  slug: string,
  role: StaffRole,
): Promise<StaffAuthContext | null> {
  void req;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data: account, error } = await admin
    .from('restaurant_staff_accounts')
    .select('id, restaurant_id, role, disabled_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!error && account && !account.disabled_at) {
    const { data: restaurant } = await admin
      .from('restaurants')
      .select('slug')
      .eq('id', account.restaurant_id as string)
      .maybeSingle();

    if (
      restaurant &&
      (restaurant.slug as string) === slug &&
      account.role === role
    ) {
      return {
        restaurant_id: account.restaurant_id as string,
        slug,
        role,
        user_id: user.id,
      };
    }
  }

  const { data: asOwner } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('slug', slug)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!asOwner) return null;

  return {
    restaurant_id: asOwner.id as string,
    slug,
    role,
    user_id: user.id,
  };
}
