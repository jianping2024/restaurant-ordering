import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerSupabaseAuth } from '@/lib/supabase/route-handler-auth';

export const runtime = 'nodejs';

/** Server-side sign-out — clears Supabase SSR session cookies reliably (incl. mobile Safari). */
export async function POST() {
  const cookieStore = await cookies();
  const { supabase, attachCookies } = createRouteHandlerSupabaseAuth(cookieStore);
  await supabase.auth.signOut();
  const response = NextResponse.json({ ok: true });
  attachCookies(response);
  return response;
}
