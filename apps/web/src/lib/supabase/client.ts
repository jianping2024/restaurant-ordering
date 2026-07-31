import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseUrl } from '@/lib/supabase/url';

/** Browser Supabase client (client components). */
export function createClient() {
  return createBrowserClient(
    getSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
