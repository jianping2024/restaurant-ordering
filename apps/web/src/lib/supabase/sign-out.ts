import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sole sign-out call — revokes only this device's session.
 * auth-js defaults to `global`, which also kills every other device of a shared
 * staff account (and a fresh login when a stale board auto-exits). Do not call
 * `auth.signOut()` directly; kicking all sessions is `kickStaffUserSessions` (admin).
 */
export function signOutThisDevice(supabase: Pick<SupabaseClient, 'auth'>) {
  return supabase.auth.signOut({ scope: 'local' });
}
