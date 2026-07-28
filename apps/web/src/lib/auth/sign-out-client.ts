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

export async function signOutFromSupabase(): Promise<void> {
  const ok = await signOutViaServer();
  if (ok) return;

  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function dashboardSignOutAndRedirect(): Promise<void> {
  try {
    await signOutFromSupabase();
  } finally {
    window.location.replace('/auth/login');
  }
}
