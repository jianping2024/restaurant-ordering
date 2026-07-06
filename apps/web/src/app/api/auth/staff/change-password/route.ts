import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { changeStaffPasswordWithSession } from '@/lib/auth/staff-change-password';
import { createRouteHandlerSupabaseAuth } from '@/lib/supabase/route-handler-auth';

export const runtime = 'nodejs';

function errorStatus(error: string): number {
  if (error === 'unauthorized') return 401;
  if (error === 'invalid_password') return 401;
  return 400;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const { supabase, attachCookies } = createRouteHandlerSupabaseAuth(cookieStore);

  const result = await changeStaffPasswordWithSession(supabase, {
    currentPassword,
    newPassword,
    confirmPassword,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
  }

  const response = NextResponse.json({ ok: true, path: result.path });
  attachCookies(response);
  return response;
}
