import { NextResponse } from 'next/server';
import { resolvePostLoginRedirect } from '@/lib/auth/post-login-redirect';
import {
  isStaffAuthEmail,
  resolveAuthIdentifier,
  staffLoginNameFromAuthEmail,
} from '@/lib/auth/resolve-auth-identifier';
import { staffSignInPreflight } from '@/lib/auth/staff-sign-in-preflight';
import {
  authLoginRateLimitCheck,
  authLoginRecordFailure,
  authLoginRecordSuccess,
} from '@/lib/auth/login-rate-limit';
import { isDependencyFailure } from '@/lib/dependency-unavailable';
import { dependencyUnavailableJsonResponse } from '@/lib/dependency-unavailable-response';
import { clientIpFromRequest } from '@/lib/request-client-ip';
import { createRouteHandlerSupabaseAuth } from '@/lib/supabase/route-handler-auth';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

function readAccount(body: Record<string, unknown>): string {
  if (typeof body.account === 'string') return body.account;
  if (typeof body.email === 'string') return body.email;
  return '';
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const accountRaw = readAccount(body);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!accountRaw.trim() || !password) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const resolved = resolveAuthIdentifier(accountRaw);
  if (!resolved) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const { email } = resolved;
  const ip = clientIpFromRequest(req);
  const rl = authLoginRateLimitCheck(email, ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_sec: rl.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  if (isStaffAuthEmail(email)) {
    const loginName =
      resolved.loginName ?? staffLoginNameFromAuthEmail(email);
    if (loginName) {
      try {
        const preflight = await staffSignInPreflight(loginName);
        if (!preflight.ok) {
          authLoginRecordFailure(email, ip);
          const status = preflight.code === 'restaurant_suspended' ? 403 : 401;
          return NextResponse.json({ error: preflight.code }, { status });
        }
      } catch (e) {
        if (isDependencyFailure(e)) {
          return dependencyUnavailableJsonResponse();
        }
        const message = e instanceof Error ? e.message : 'redirect_failed';
        return NextResponse.json({ error: 'redirect_failed', message }, { status: 500 });
      }
    }
  }

  const cookieStore = await cookies();
  const { supabase, attachCookies } = createRouteHandlerSupabaseAuth(cookieStore);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    if (error && isDependencyFailure(error)) {
      return dependencyUnavailableJsonResponse();
    }
    authLoginRecordFailure(email, ip);
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  try {
    const redirect = await resolvePostLoginRedirect(
      supabase,
      data.user.id,
      data.user.user_metadata as Record<string, unknown>,
      { staffPreflightPassed: isStaffAuthEmail(email) && !!resolved.loginName },
    );

    if (redirect.kind === 'staff_error') {
      await supabase.auth.signOut();
      authLoginRecordFailure(email, ip);
      const response = NextResponse.json({ error: redirect.code }, { status: 403 });
      attachCookies(response);
      return response;
    }

    authLoginRecordSuccess(email, ip);

    if (redirect.kind === 'staff') {
      const response = NextResponse.json({
        ok: true,
        kind: 'staff',
        path: redirect.mustChangePassword ? '/auth/staff/change-password' : redirect.path,
        must_change_password: redirect.mustChangePassword,
        slug: redirect.slug,
        role: redirect.role,
      });
      attachCookies(response);
      return response;
    }

    const response = NextResponse.json({
      ok: true,
      kind: redirect.kind,
      path: redirect.path,
    });
    attachCookies(response);
    return response;
  } catch (e) {
    await supabase.auth.signOut();
    if (isDependencyFailure(e)) {
      const response = dependencyUnavailableJsonResponse();
      attachCookies(response);
      return response;
    }
    const message = e instanceof Error ? e.message : 'redirect_failed';
    const response = NextResponse.json({ error: 'redirect_failed', message }, { status: 500 });
    attachCookies(response);
    return response;
  }
}
