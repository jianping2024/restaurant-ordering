import 'server-only';

import { redirect } from 'next/navigation';
import { resolveStaffAccess, type StaffAccessOk } from '@/lib/staff-access';
import type { StaffRole } from '@/lib/staff-account';

/** Server-side gate for slug staff pages — redirects before render when access is denied. */
export async function requireStaffSlugPageAccess(
  slug: string,
  allowedRoles: StaffRole[],
): Promise<StaffAccessOk> {
  const access = await resolveStaffAccess(slug, allowedRoles);
  if (access.status === 'ok') return access;

  if (access.reason === 'needs_password_change') {
    redirect('/auth/staff/change-password');
  }

  redirect(`/${slug}/staff/login`);
}
