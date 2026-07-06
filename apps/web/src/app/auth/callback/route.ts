import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerSupabaseAuth } from '@/lib/supabase/route-handler-auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const nextRaw = searchParams.get('next') ?? '/dashboard';
  const next =
    nextRaw.startsWith('/') && !nextRaw.startsWith('//') && !nextRaw.includes('\\')
      ? nextRaw
      : '/dashboard';

  const redirectUrl = new URL(next, request.url);
  const response = NextResponse.redirect(redirectUrl);

  if (code) {
    const { supabase, attachCookies } = createRouteHandlerSupabaseAuth(request.cookies);
    await supabase.auth.exchangeCodeForSession(code);
    attachCookies(response);
  }

  return response;
}
