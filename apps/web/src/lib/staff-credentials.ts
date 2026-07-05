import {
  buildStaffEmail,
  sanitizeStaffLoginInput,
  validateLoginName,
} from '@/lib/staff-account';

export type StaffCredentials =
  | { ok: true; loginName: string; email: string }
  | { ok: false };

/** Normalize and validate a staff login name; derive Supabase Auth email internally. */
export function resolveStaffCredentials(raw: string): StaffCredentials {
  const loginName = sanitizeStaffLoginInput(raw);
  const validation = validateLoginName(loginName);
  if (!validation.ok) {
    return { ok: false };
  }
  return {
    ok: true,
    loginName: validation.normalized,
    email: buildStaffEmail(validation.normalized),
  };
}
