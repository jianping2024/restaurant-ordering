import type { SupabaseClient } from '@supabase/supabase-js';
import { STAFF_EMAIL_DOMAIN } from './staff-email-domain';

export async function kickStaffUserSessions(admin: SupabaseClient, userId: string) {
  try {
    await admin.auth.admin.signOut(userId, 'global');
  } catch {
    // best-effort
  }
}

export async function setStaffUserBanned(admin: SupabaseClient, userId: string, banned: boolean) {
  await admin.auth.admin.updateUserById(userId, {
    ban_duration: banned ? '876000h' : 'none',
  });
}

/**
 * Sole Auth mailbox for a staff login that was removed from restaurant_staff_accounts
 * but could not be hard-deleted (e.g. audit FKs). Frees `{login}@mesa.in` for recreate.
 */
export function retiredStaffAuthEmail(userId: string): string {
  const compact = userId.replace(/-/g, '').toLowerCase();
  return `deleted.${compact}@${STAFF_EMAIL_DOMAIN}`;
}

/**
 * Sole Auth retirement after the staff account row is gone:
 * hard-delete when possible; otherwise keep banned and free the staff email.
 * Never throws — business success is the missing staff row.
 */
export async function retireStaffAuthUser(
  admin: SupabaseClient,
  userId: string,
): Promise<'deleted' | 'retained'> {
  try {
    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    if (!delError) return 'deleted';

    const { error: freeError } = await admin.auth.admin.updateUserById(userId, {
      email: retiredStaffAuthEmail(userId),
      email_confirm: true,
      ban_duration: '876000h',
    });
    if (freeError) {
      // already banned before row delete; email free is best-effort
    }
    return 'retained';
  } catch {
    return 'retained';
  }
}
