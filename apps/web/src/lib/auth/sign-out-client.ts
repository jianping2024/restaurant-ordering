'use client';

import { clearCustomerMenuCatalogCache } from '@/lib/customer-menu-catalog-client-cache';
import { clearPwaShellCaches } from '@/lib/pwa/shell-sw';
import { createClient } from '@/lib/supabase/client';
import { signOutThisDevice } from '@/lib/supabase/sign-out';

async function signOutViaServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Clear Supabase session (server route first, browser client fallback). */
export async function signOutFromSupabase(): Promise<void> {
  const ok = await signOutViaServer();
  if (ok) return;

  const supabase = createClient();
  await signOutThisDevice(supabase);
}

/** Sign out then hard-navigate — one path for dashboard, staff boards, and auth flows. */
export async function signOutAndRedirect(loginPath: string): Promise<void> {
  try {
    await signOutFromSupabase();
  } finally {
    clearCustomerMenuCatalogCache();
    await clearPwaShellCaches();
    window.location.replace(loginPath);
  }
}

export function dashboardSignOutAndRedirect(): Promise<void> {
  return signOutAndRedirect('/auth/login');
}
