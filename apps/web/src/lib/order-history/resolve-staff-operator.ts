import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveOwnerOperatorName } from '@/lib/audit/resolve-actor';

/** Resolve staff/owner display names for session open/close operators. */
export async function resolveStaffOperatorNames(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    ownerId: string;
    restaurantName: string;
    userIds: string[];
  },
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(params.userIds.filter(Boolean)));
  const names = new Map<string, string>();
  if (uniqueIds.length === 0) return names;

  const { data: staffRows } = await admin
    .from('restaurant_staff_accounts')
    .select('user_id, display_name')
    .eq('restaurant_id', params.restaurantId)
    .in('user_id', uniqueIds);

  for (const row of staffRows || []) {
    const userId = row.user_id as string;
    const displayName = (row.display_name as string | undefined)?.trim();
    if (displayName) names.set(userId, displayName);
  }

  for (const userId of uniqueIds) {
    if (names.has(userId)) continue;
    if (userId === params.ownerId) {
      names.set(userId, resolveOwnerOperatorName(params.restaurantName, undefined));
    }
  }

  return names;
}

export async function resolveStaffOperatorName(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    ownerId: string;
    restaurantName: string;
    userId: string | null | undefined;
  },
): Promise<string | null> {
  if (!params.userId) return null;
  const names = await resolveStaffOperatorNames(admin, {
    restaurantId: params.restaurantId,
    ownerId: params.ownerId,
    restaurantName: params.restaurantName,
    userIds: [params.userId],
  });
  return names.get(params.userId) ?? null;
}
