import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from '@/lib/supabase/url';

/** Avoid Next.js fetch Data Cache on admin REST GETs (stale reads after writes). */
function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, cache: 'no-store' });
}

/** Server-only: Supabase Admin API (requires SUPABASE_SERVICE_ROLE_KEY). */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set for admin operations');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: adminFetch },
  });
}
