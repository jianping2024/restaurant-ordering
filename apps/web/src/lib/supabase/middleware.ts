import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { dashboardMiddlewareRedirectPath } from '@/lib/dashboard-paths';
import {
  dashboardStaffMiddlewareRedirectPath,
  middlewareAllowsOwnerPath,
} from '@/lib/dashboard-feature-registry';
import { resolvePostLoginRedirect } from '@/lib/auth/post-login-redirect';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loadOwnedRestaurantIdForUser,
  loadStaffGateAccountForUser,
} from '@/lib/staff-gate-db';
import { parseStaffUserMetadata } from '@/lib/staff-account';
import { loadStaffCapabilitiesForGateAccount } from '@/lib/permissions/staff-landing';
import { getSupabaseUrl } from '@/lib/supabase/url';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith('/dashboard')) {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return supabaseResponse;
    }

    const ownedRestaurantId = await loadOwnedRestaurantIdForUser(admin, user.id);
    if (ownedRestaurantId) {
      if (!middlewareAllowsOwnerPath(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = dashboardMiddlewareRedirectPath('owner', pathname) ?? '/dashboard/settings';
        return NextResponse.redirect(url);
      }
    } else {
      const staff = await loadStaffGateAccountForUser(admin, user.id);
      if (staff && !staff.disabled_at) {
        const meta = parseStaffUserMetadata(
          user.user_metadata as Record<string, unknown>,
        );
        const slug =
          staff.restaurant?.slug ?? meta?.restaurant_slug ?? '';
        if (slug) {
          const capabilities = await loadStaffCapabilitiesForGateAccount(admin, staff);
          const redirectPath = dashboardStaffMiddlewareRedirectPath(
            capabilities,
            pathname,
            slug,
          );
          if (redirectPath) {
            const url = request.nextUrl.clone();
            url.pathname = redirectPath;
            return NextResponse.redirect(url);
          }
        }
      }
    }
  }

  // Logged-in users accessing login pages → redirect to their workspace
  // Aligns with mainstream SaaS behavior (GitHub, Slack, etc.)
  // Reuses resolvePostLoginRedirect to handle must_change_password correctly
  if (user && (pathname === '/auth/login' || pathname.match(/^\/[^/]+\/staff\/login$/))) {
    try {
      const redirect = await resolvePostLoginRedirect(
        supabase,
        user.id,
        user.user_metadata as Record<string, unknown>,
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

      const targetPath =
        redirect.kind === 'owner'
          ? '/dashboard/settings'
          : redirect.kind === 'onboarding'
            ? '/dashboard'
            : redirect.path;

      const url = request.nextUrl.clone();
      url.pathname = targetPath;
      return NextResponse.redirect(url);
    } catch {
      // On error, allow access to login page
      return supabaseResponse;
    }
  }

  return supabaseResponse;
}
