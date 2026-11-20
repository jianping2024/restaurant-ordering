import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sole access to `staff_identities` (account-level staff fields; multi-store plan §5.1).
 * One row per staff account (incl. print_agent); admin accounts have none.
 * Server/admin client only — the table has no anon/authenticated grants.
 */

export type StaffIdentity = {
  user_id: string;
  login_name: string;
  must_change_password: boolean;
};

const STAFF_IDENTITY_COLUMNS = 'user_id, login_name, must_change_password';

function normalizeStaffIdentity(raw: unknown): StaffIdentity | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.user_id !== 'string' || typeof row.login_name !== 'string') return null;
  return {
    user_id: row.user_id,
    login_name: row.login_name,
    must_change_password: row.must_change_password === true,
  };
}

export async function loadStaffIdentity(
  admin: SupabaseClient,
  userId: string,
): Promise<StaffIdentity | null> {
  const { data, error } = await admin
    .from('staff_identities')
    .select(STAFF_IDENTITY_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeStaffIdentity(data);
}

/** user_id → login_name for display (one query for any number of accounts). */
export async function loadStaffLoginNames(
  admin: SupabaseClient,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const names = new Map<string, string>();
  if (ids.length === 0) return names;
  const { data, error } = await admin
    .from('staff_identities')
    .select('user_id, login_name')
    .in('user_id', ids);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    if (typeof row.user_id === 'string' && typeof row.login_name === 'string') {
      names.set(row.user_id, row.login_name);
    }
  }
  return names;
}

/**
 * New staff account identity. `login_name` is globally unique —
 * a 23505 error means the name is taken (never say which store).
 */
export async function insertStaffIdentity(
  admin: SupabaseClient,
  input: { userId: string; loginName: string; mustChangePassword: boolean },
): Promise<{ error: { code?: string; message: string } | null }> {
  const { error } = await admin.from('staff_identities').insert({
    user_id: input.userId,
    login_name: input.loginName,
    must_change_password: input.mustChangePassword,
  });
  return { error: error ? { code: error.code, message: error.message } : null };
}

/** Sole writer of the forced password change flag (account-level, plan §7). */
export async function setStaffMustChangePassword(
  admin: SupabaseClient,
  userId: string,
  mustChangePassword: boolean,
): Promise<void> {
  const { error } = await admin
    .from('staff_identities')
    .update({ must_change_password: mustChangePassword })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** Frees the login name once the account has no membership left and Auth could not be deleted. */
export async function deleteStaffIdentity(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.from('staff_identities').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}
