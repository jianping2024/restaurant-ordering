/**
 * Prem built-in backend admin identity (login name + Auth email).
 * No password here — ensure/create lives in prem-builtin-admin.ts (server-only).
 *
 * Staff reserved name `admin` already blocks restaurant_staff_accounts rows;
 * on MESA_ON_PREM hosts, bare `admin` maps to this Auth email instead.
 */

export const PREM_BUILTIN_ADMIN_LOGIN_NAME = 'admin';

/** Auth email — not @mesa.in (staff domain). */
export const PREM_BUILTIN_ADMIN_EMAIL = 'admin@mesa.prem';

export const PREM_BUILTIN_ADMIN_ACCOUNT_TYPE = 'prem_builtin_admin';

export function isPremBuiltinAdminLoginName(raw: string): boolean {
  const trimmed = raw.trim().toLowerCase();
  return trimmed === PREM_BUILTIN_ADMIN_LOGIN_NAME && !trimmed.includes('@');
}

export function isPremBuiltinAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PREM_BUILTIN_ADMIN_EMAIL;
}

export function isPremBuiltinAdminMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return metadata?.account_type === PREM_BUILTIN_ADMIN_ACCOUNT_TYPE;
}

/** Sole actor check for the prem built-in admin (email or metadata). */
export function isPremBuiltinAdminActor(params: {
  email?: string | null;
  userMetadata?: Record<string, unknown> | null;
}): boolean {
  return (
    isPremBuiltinAdminEmail(params.email) ||
    isPremBuiltinAdminMetadata(params.userMetadata)
  );
}
