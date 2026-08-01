import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { buildMiddlewareMatcher } from '@/lib/supabase/middleware-session-policy';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Sole skip list: apps/web/src/lib/supabase/middleware-session-policy.ts
  matcher: buildMiddlewareMatcher(),
};
