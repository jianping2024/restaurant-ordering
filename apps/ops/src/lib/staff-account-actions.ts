import type { SupabaseClient } from '@supabase/supabase-js';

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
