import {
  buildStaffEmail,
  STAFF_EMAIL_DOMAIN,
  validateLoginName,
} from '@/lib/staff-account';
import { resolveStaffCredentials } from '@/lib/staff-credentials';

export type AuthIdentifierKind = 'owner_email' | 'staff';

export type ResolvedAuthIdentifier = {
  email: string;
  kind: AuthIdentifierKind;
  /** Set when kind is staff (for preflight and rate-limit clarity). */
  loginName: string | null;
};

export function isStaffAuthEmail(email: string): boolean {
  return email.endsWith(`@${STAFF_EMAIL_DOMAIN}`);
}

/** Extract login_name from a legacy staff auth email, if valid. */
export function staffLoginNameFromAuthEmail(email: string): string | null {
  const suffix = `@${STAFF_EMAIL_DOMAIN}`;
  if (!email.endsWith(suffix)) return null;
  const local = email.slice(0, -suffix.length);
  const validation = validateLoginName(local);
  return validation.ok ? validation.normalized : null;
}

/**
 * Map user-facing account input to Supabase Auth email.
 * - Contains `@` → treat as full email (owner or legacy staff paste).
 * - Otherwise → staff login_name.
 */
export function resolveAuthIdentifier(raw: string): ResolvedAuthIdentifier | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    const loginName = staffLoginNameFromAuthEmail(trimmed);
    return {
      email: trimmed,
      kind: loginName ? 'staff' : 'owner_email',
      loginName,
    };
  }

  const staff = resolveStaffCredentials(trimmed);
  if (!staff.ok) return null;

  return {
    email: staff.email,
    kind: 'staff',
    loginName: staff.loginName,
  };
}

/** Re-export for tests that assert email derivation. */
export { buildStaffEmail };
