'use client';

import { createClient } from '@/lib/supabase/client';

export async function signOutFromSupabase(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function dashboardSignOutAndRedirect(router: {
  push: (path: string) => void;
  refresh: () => void;
}): Promise<void> {
  await signOutFromSupabase();
  router.push('/auth/login');
  router.refresh();
}
