import type { SupabaseClient } from '@supabase/supabase-js';
import { retireStaffAuthUser } from './staff-user-ban';

/**
 * Sole membership (店籍) removal + last-store retirement (multi-store plan §3 rule 3, §7).
 * Store delete removes only that store's row; the account is retired (Auth + `staff_identities`)
 * only when no membership is left and it is not any store's admin account.
 * Used by web staff delete, ops restaurant purge, and ops unlink (batch 2C).
 */

/** Rule 4 actor for password / login-name changes inside one store. */
export type StaffCredentialActor = 'store_admin' | 'store_staff';

/**
 * Rule 4: a multi-store account's password / login name is changed only by itself, ops, or the
 * admin account (`owner_id`) of a store it belongs to. Store staff with `settings.staff.manage`
 * may change it only while the account belongs to one store.
 */
export function staffCredentialsEditableByStore(input: {
  storeCount: number;
  actor: StaffCredentialActor;
}): boolean {
  if (input.actor === 'store_admin') return true;
  return input.storeCount <= 1;
}

/** user_id → number of memberships (店籍), one query for any number of accounts. */
export async function countStaffMemberships(
  admin: SupabaseClient,
  userIds: readonly string[],
): Promise<Map<string, number>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  const { data, error } = await admin
    .from('restaurant_staff_accounts')
    .select('user_id')
    .in('user_id', ids);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const id = typeof row.user_id === 'string' ? row.user_id : '';
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Pure: candidates with no membership left and not owning any store → retire. */
export function userIdsWithoutStoreLeft(input: {
  candidates: readonly string[];
  membershipCounts: ReadonlyMap<string, number>;
  ownerIds: ReadonlySet<string>;
}): string[] {
  return Array.from(new Set(input.candidates.filter(Boolean))).filter(
    (id) => (input.membershipCounts.get(id) ?? 0) === 0 && !input.ownerIds.has(id),
  );
}

export type RetireAccountsResult = { retired: string[]; deleted: number; retained: number };

/**
 * Retire every candidate that has no store left (no membership, not an admin account).
 * Call after the membership rows / restaurant are gone. Never throws on Auth failures.
 */
export async function retireAccountsWithoutStoreLeft(
  admin: SupabaseClient,
  candidates: readonly string[],
): Promise<RetireAccountsResult> {
  const ids = Array.from(new Set(candidates.filter(Boolean)));
  if (ids.length === 0) return { retired: [], deleted: 0, retained: 0 };

  const membershipCounts = await countStaffMemberships(admin, ids);
  const { data: owned, error } = await admin
    .from('restaurants')
    .select('owner_id')
    .in('owner_id', ids);
  if (error) throw new Error(error.message);
  const ownerIds = new Set(
    (owned ?? []).map((r) => (typeof r.owner_id === 'string' ? r.owner_id : '')).filter(Boolean),
  );

  const retired = userIdsWithoutStoreLeft({ candidates: ids, membershipCounts, ownerIds });
  let deleted = 0;
  let retained = 0;
  for (const userId of retired) {
    if ((await retireStaffAuthUser(admin, userId)) === 'deleted') deleted += 1;
    else retained += 1;
  }
  return { retired, deleted, retained };
}

export type RemoveStaffMembershipResult =
  | { ok: true; accountRetired: boolean }
  | { ok: false; error: 'delete_failed'; message: string };

/**
 * Delete one store's membership row; retire the account only if it was the last store.
 * Never bans or kicks sessions for the other stores (rule 3).
 */
export async function removeStaffMembership(
  admin: SupabaseClient,
  input: { restaurantId: string; membershipId: string; userId: string },
): Promise<RemoveStaffMembershipResult> {
  const { error } = await admin
    .from('restaurant_staff_accounts')
    .delete()
    .eq('id', input.membershipId)
    .eq('restaurant_id', input.restaurantId);
  if (error) return { ok: false, error: 'delete_failed', message: error.message };

  const { retired } = await retireAccountsWithoutStoreLeft(admin, [input.userId]);
  return { ok: true, accountRetired: retired.length > 0 };
}
