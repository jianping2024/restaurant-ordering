import { NextResponse, type NextRequest } from 'next/server';
import { dashboardCapabilityMiddlewareRedirectPath } from '@/lib/dashboard-feature-registry';
import { resolvePostLoginRedirect } from '@/lib/auth/post-login-redirect';
import { createAdminClient } from '@/lib/supabase/admin';
import { DASHBOARD_ENTRY_PATH, parseDashboardStorePath } from '@/lib/dashboard-store-routes';
import {
  loadOwnerRestaurantForUser,
  loadRestaurantRefBySlug,
  resolvePrincipalForRestaurantWith,
} from '@/lib/staff-gate-db';
import {
  isInvalidRefreshTokenError,
  shouldBypassMiddlewareSession,
} from '@/lib/supabase/middleware-session-policy';
import { signOutThisDevice } from '@/lib/supabase/sign-out';
import {
  LAST_RESTAURANT_COOKIE,
  LAST_RESTAURANT_COOKIE_OPTIONS,
  formatLastRestaurantCookie,
  parseLastRestaurantCookie,
} from '@/lib/last-restaurant-cookie';
import { getSupabaseAuthCookieOptions, getSupabaseUrl } from '@/lib/supabase/url';
import { createServerClient } from '@supabase/ssr';

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Defense in depth — matcher should already exclude these (same policy module).
  if (shouldBypassMiddlewareSession(pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getSupabaseAuthCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (isInvalidRefreshTokenError(userError)) {
    // Clear bad cookies once so Edge/Auth stop thrashing on every request.
    await signOutThisDevice(supabase);
  }

  const sessionUser = isInvalidRefreshTokenError(userError) ? null : user;

  if (!sessionUser && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // Store pages: the store is the URL slug (never user_metadata). Capability gate per store;
  // unknown slug / no access → store-less entry, which lands on the account's store.
  const storePath = sessionUser ? parseDashboardStorePath(pathname) : null;
  if (sessionUser && storePath) {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return supabaseResponse;
    }

    const restaurant = await loadRestaurantRefBySlug(admin, storePath.slug);
    const access = restaurant
      ? await resolvePrincipalForRestaurantWith(admin, {
          userId: sessionUser.id,
          restaurantId: restaurant.id,
          owned: await loadOwnerRestaurantForUser(admin, {
            userId: sessionUser.id,
            email: sessionUser.email,
            userMetadata: sessionUser.user_metadata as Record<string, unknown>,
          }),
        })
      : null;
    const redirectPath = access
      ? dashboardCapabilityMiddlewareRedirectPath(
          access.capabilities,
          storePath.page,
          access.restaurant.slug,
        )
      : DASHBOARD_ENTRY_PATH;
    let response = supabaseResponse;
    if (redirectPath) {
      const url = request.nextUrl.clone();
      url.pathname = redirectPath;
      response = NextResponse.redirect(url);
    }
    if (access) {
      // «上次所在店» (plan §6.3): UX default only, rewritten only when it changes.
      const value = formatLastRestaurantCookie(sessionUser.id, access.restaurant.id);
      if (request.cookies.get(LAST_RESTAURANT_COOKIE)?.value !== value) {
        response.cookies.set(LAST_RESTAURANT_COOKIE, value, LAST_RESTAURANT_COOKIE_OPTIONS);
      }
    }
    return response;
  }

  // Logged-in users accessing login pages → redirect to their workspace
  // Aligns with mainstream SaaS behavior (GitHub, Slack, etc.)
  // Reuses resolvePostLoginRedirect to handle must_change_password correctly
  const storeLoginSlug = pathname.match(/^\/([^/]+)\/staff\/login$/)?.[1] ?? null;
  if (sessionUser && (pathname === '/auth/login' || storeLoginSlug)) {
    try {
      const redirect = await resolvePostLoginRedirect(
        supabase,
        sessionUser.id,
        sessionUser.user_metadata as Record<string, unknown>,
        {
          email: sessionUser.email,
          lastRestaurantId: parseLastRestaurantCookie(
            request.cookies.get(LAST_RESTAURANT_COOKIE)?.value,
            sessionUser.id,
          ),
          preferredSlug: storeLoginSlug ? decodeURIComponent(storeLoginSlug) : null,
        },
      );

      if (redirect.kind === 'staff_error') {
        // Staff error → allow them to see login page (will handle via page logic)
        return supabaseResponse;
      }

      if (redirect.kind === 'staff' && redirect.mustChangePassword) {
        const url = request.nextUrl.clone();
        url.pathname = '/auth/staff/change-password';
        return NextResponse.redirect(url);
      }

      // Owner / onboarding / staff all carry the landing path from resolvePostLoginRedirect.
      const url = request.nextUrl.clone();
      url.pathname = redirect.path;
      return NextResponse.redirect(url);
    } catch {
      // On error, allow access to login page
      return supabaseResponse;
    }
  }

  return supabaseResponse;
}
