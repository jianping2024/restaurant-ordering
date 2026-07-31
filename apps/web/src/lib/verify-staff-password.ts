import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { getSupabaseUrl } from '@/lib/supabase/url';

export type VerifyStaffPasswordError = 'unauthorized' | 'invalid_password' | 'misconfigured';

/** Re-verify the signed-in staff user's login password without replacing the session cookies. */
export async function verifyStaffPassword(
  password: string,
): Promise<{ ok: true } | { ok: false; error: VerifyStaffPasswordError }> {
  const trimmed = password.trim();
  if (!trimmed) {
    return { ok: false, error: 'invalid_password' };
  }

  const sessionClient = await createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: 'unauthorized' };
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    return { ok: false, error: 'misconfigured' };
  }

  let url: string;
  try {
    url = getSupabaseUrl();
  } catch {
    return { ok: false, error: 'misconfigured' };
  }

  const verifyClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password: trimmed,
  });
  if (error) {
    return { ok: false, error: 'invalid_password' };
  }

  return { ok: true };
}
