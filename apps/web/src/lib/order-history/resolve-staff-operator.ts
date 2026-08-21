import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveOperatorUsernameFromAuthUser,
  resolveOwnerOperatorName,
  resolveStaffOperatorDisplayName,
} from '@/lib/audit/resolve-actor';

/**
 * Resolve staff/owner labels for board opener + order-history operators.
 * Same ladder as audit actors: staff row via {@link resolveStaffOperatorDisplayName},
 * then Auth username, then owner restaurant name.
 */
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
    .select('user_id, display_name, login_name')
    .eq('restaurant_id', params.restaurantId)
    .in('user_id', uniqueIds);

  for (const row of staffRows || []) {
    const userId = row.user_id as string;
    const label = resolveStaffOperatorDisplayName({
      display_name: row.display_name as string | null | undefined,
      login_name: row.login_name as string | null | undefined,
    });
    if (label) names.set(userId, label);
  }

  for (const userId of uniqueIds) {
    if (names.has(userId)) continue;
    const fromAuth = await resolveOperatorUsernameFromAuthUser(admin, userId);
    if (fromAuth) {
      names.set(userId, fromAuth);
      continue;
    }
    if (params.ownerId && userId === params.ownerId) {
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
