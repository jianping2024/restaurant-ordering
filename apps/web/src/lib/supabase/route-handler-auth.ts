import { createServerClient } from '@supabase/ssr';
import type { NextResponse } from 'next/server';

type CookieStore = {
  getAll(): { name: string; value: string }[];
};

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse['cookies']['set']>[2];
};

/**
 * Supabase auth in Route Handlers — collect Set-Cookie on the outgoing NextResponse
 * (same contract as auth/callback; do not rely on cookieStore.set alone).
 */
export function createRouteHandlerSupabaseAuth(cookieStore: CookieStore) {
  const pending: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          pending.push(...cookiesToSet);
        },
      },
    },
  );

  return {
    supabase,
    attachCookies(response: NextResponse) {
      for (const { name, value, options } of pending) {
        response.cookies.set(name, value, options);
      }
    },
  };
}
