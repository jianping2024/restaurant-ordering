import 'server-only';

import { redirect } from 'next/navigation';
import type { PermissionKey } from '@/lib/permissions/registry';
import { staffAuthForPage, type StaffAuthContext } from '@/lib/staff-api-auth';

/** Server-side gate for slug staff pages — capability only (no role whitelist). */
export async function requireStaffSlugPagePermission(
  slug: string,
  permission: PermissionKey,
): Promise<StaffAuthContext> {
  const access = await staffAuthForPage(slug, permission);
  if (access) return access;
  redirect(`/${slug}/staff/login`);
}
