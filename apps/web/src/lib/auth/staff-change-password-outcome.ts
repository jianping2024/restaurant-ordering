import type { User } from '@supabase/supabase-js';
import type { StaffUserMetadata } from '../staff-account';
import { staffRolePath } from '../staff-routes';

/** Pure post-auth decision: staff clears must_change_password + role path; other sessions stay put. */
export function resolveStaffPasswordChangeSuccess(
  user: User,
  meta: StaffUserMetadata | null,
): { updateData: Record<string, unknown> | undefined; path: string | null } {
  if (meta) {
    return {
      updateData: { ...user.user_metadata, must_change_password: false },
      path: staffRolePath(meta.restaurant_slug, meta.staff_role),
    };
  }
  return { updateData: undefined, path: null };
}
