import { NextResponse } from 'next/server';
import { isRestaurantSuspended } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePostLoginRedirect } from '@/lib/auth/post-login-redirect';
import {
  authLoginRateLimitCheck,
  authLoginRecordFailure,
  authLoginRecordSuccess,
} from '@/lib/auth/login-rate-limit';
import { clientIpFromRequest } from '@/lib/request-client-ip';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const ip = clientIpFromRequest(req);
  const rl = authLoginRateLimitCheck(email, ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_sec: rl.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: account } = await admin
    .from('restaurant_staff_accounts')
    .select('id, disabled_at, role, restaurant_id')
    .eq('email', email)
    .maybeSingle();

  if (!account || account.disabled_at) {
    authLoginRecordFailure(email, ip);
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const { data: restaurantRow } = await admin
    .from('restaurants')
    .select('suspended_at')
    .eq('id', account.restaurant_id as string)
    .maybeSingle();

  if (isRestaurantSuspended(restaurantRow?.suspended_at as string | null | undefined)) {
    authLoginRecordFailure(email, ip);
    return NextResponse.json({ error: 'restaurant_suspended' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    authLoginRecordFailure(email, ip);
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  try {
    const redirect = await resolvePostLoginRedirect(
      supabase,
      data.user.id,
      data.user.user_metadata as Record<string, unknown>,
    );

    if (redirect.kind === 'staff_error') {
      await supabase.auth.signOut();
      authLoginRecordFailure(email, ip);
      return NextResponse.json({ error: redirect.code }, { status: 403 });
    }

    if (redirect.kind !== 'staff') {
      await supabase.auth.signOut();
      authLoginRecordFailure(email, ip);
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    authLoginRecordSuccess(email, ip);

    return NextResponse.json({
      ok: true,
      path: redirect.mustChangePassword ? '/auth/staff/change-password' : redirect.path,
      must_change_password: redirect.mustChangePassword,
      slug: redirect.slug,
      role: redirect.role,
    });
  } catch (e) {
    await supabase.auth.signOut();
    const message = e instanceof Error ? e.message : 'redirect_failed';
    return NextResponse.json({ error: 'redirect_failed', message }, { status: 500 });
  }
}
