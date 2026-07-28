'use client';

import { createClient } from '@/lib/supabase/client';

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
  await supabase.auth.signOut();
}

/** Sign out then hard-navigate — one path for dashboard, staff boards, and auth flows. */
export async function signOutAndRedirect(loginPath: string): Promise<void> {
  try {
    await signOutFromSupabase();
  } finally {
    window.location.replace(loginPath);
  }
}

export function dashboardSignOutAndRedirect(): Promise<void> {
  return signOutAndRedirect('/auth/login');
}
