import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  isCashierCheckoutPath,
  isCashierStaffUser,
  isDashboardSettingsPath,
  isFrontdeskOperationalPath,
  isFrontdeskStaffUser,
  isOwnerDashboardPath,
  isOwnerDashboardUser,
} from '@/lib/dashboard-access';

// Middleware 中使用的 Supabase 客户端
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

  // 未登录用户访问 dashboard 重定向到登录页
  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith('/dashboard')) {
    const userMetadata = user.user_metadata as Record<string, unknown>;
    const isOwner = await isOwnerDashboardUser(supabase, user.id);
    const isFrontdesk = await isFrontdeskStaffUser(supabase, user.id, userMetadata);
    const isCashier = await isCashierStaffUser(supabase, user.id, userMetadata);

    if (isOwner) {
      if (!isOwnerDashboardPath(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard/settings';
        return NextResponse.redirect(url);
      }
    } else if (isFrontdesk) {
      if (isDashboardSettingsPath(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
      if (!isFrontdeskOperationalPath(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
    } else if (isCashier) {
      if (pathname === '/dashboard' || pathname === '/dashboard/') {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard/checkout';
        return NextResponse.redirect(url);
      }
      if (!isCashierCheckoutPath(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard/checkout';
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
