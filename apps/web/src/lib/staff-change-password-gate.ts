import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseStaffUserMetadata, type StaffUserMetadata } from '@/lib/staff-account';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadStaffGateAccountForUser } from '@/lib/staff-gate-db';
import { resolveStaffLandingPath } from '@/lib/permissions/staff-landing';

/** Server gate for /auth/staff/change-password — session must exist and must_change_password. */
export async function requireStaffChangePasswordPage(): Promise<StaffUserMetadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = parseStaffUserMetadata(user?.user_metadata as Record<string, unknown> | undefined);

  if (!user || !meta) {
    redirect('/auth/login');
  }

  if (meta.must_change_password !== true) {
    const admin = createAdminClient();
    const staff = await loadStaffGateAccountForUser(admin, user.id);
    if (staff) {
      redirect(await resolveStaffLandingPath(admin, staff, meta.restaurant_slug));
    }
    redirect('/auth/login');
  }

  return meta;
}
