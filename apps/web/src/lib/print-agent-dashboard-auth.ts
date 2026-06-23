import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isRestaurantSuspended } from '@mesa/shared';

export type OwnerRestaurantAuthOptions = {
  requireWritable?: boolean;
};

export async function getOwnerRestaurantId(
  options?: OwnerRestaurantAuthOptions,
): Promise<{ restaurantId: string } | { error: string; status: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'unauthorized', status: 401 };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'server_misconfigured', status: 503 };
  }

  const { data: restaurant, error } = await admin
    .from('restaurants')
    .select('id, suspended_at')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (error) {
    return { error: 'query_failed', status: 500 };
  }
  if (!restaurant) {
    return { error: 'restaurant_not_found', status: 404 };
  }
  if (options?.requireWritable && isRestaurantSuspended(restaurant.suspended_at as string | null)) {
    return { error: 'restaurant_suspended', status: 403 };
  }
  return { restaurantId: restaurant.id as string };
}
