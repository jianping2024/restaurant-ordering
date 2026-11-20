import 'server-only';

import { redirect } from 'next/navigation';
import { loadStaffIdentity } from '@mesa/shared';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePostLoginRedirect } from '@/lib/auth/post-login-redirect';

/**
 * Server gate for /auth/staff/change-password — staff session whose
 * `staff_identities.must_change_password` is set; otherwise back to the landing.
 */
export async function requireStaffChangePasswordPage(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const identity = await loadStaffIdentity(createAdminClient(), user.id);
  if (!identity) redirect('/auth/login');
  if (identity.must_change_password) return;

  const landing = await resolvePostLoginRedirect(
    supabase,
    user.id,
    user.user_metadata as Record<string, unknown> | undefined,
    { email: user.email ?? null },
  );
  redirect(landing.kind === 'staff' ? landing.path : '/auth/login');
}
