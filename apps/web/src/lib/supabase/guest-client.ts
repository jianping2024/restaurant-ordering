import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from '@/lib/supabase/url';

let cached: SupabaseClient | null = null;

/**
 * Sole browser Supabase client for guest (QR menu) Realtime + reads.
 * Always the anon role: never reads the browser's staff/owner auth cookie, so a phone
 * logged in to another restaurant sees the same RLS-scoped data as any guest.
 * Staff surfaces keep `createClient` (`@/lib/supabase/client`).
 */
export function createGuestClient(): SupabaseClient {
  cached ??= createBrowserClient(getSupabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    isSingleton: false,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}
