import type { SupabaseClient } from '@supabase/supabase-js';

/** Batch-resolve auth user emails (actors, owners, platform admins). */
export async function fetchUserEmailsMap(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const emails = new Map<string, string | null>();
  const unique = Array.from(new Set(userIds));
  if (unique.length === 0) return emails;

  await Promise.all(
    unique.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      emails.set(id, data.user?.email ?? null);
    }),
  );

  return emails;
}
