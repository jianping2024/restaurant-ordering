'use client';

import { signOutFromSupabase } from '@/lib/auth/sign-out-client';

export async function staffSignOut(): Promise<void> {
  await signOutFromSupabase();
}
