import { STAFF_EMAIL_DOMAIN } from '@mesa/shared';

export type StaffRole = 'kitchen' | 'waiter' | 'cashier' | 'frontdesk' | 'owner';

export const STAFF_ROLES: readonly StaffRole[] = ['kitchen', 'waiter', 'cashier', 'frontdesk', 'owner'];

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export { STAFF_EMAIL_DOMAIN };

const RESERVED_LOGIN_NAMES = new Set([
  'admin',
  'kitchen',
  'waiter',
  'cashier',
  'owner',
  'root',
  'support',
]);

/** 3–32 chars; lowercase alphanumeric, `_` `-`; no dots; must start/end with alnum. */
const LOGIN_NAME_RE = /^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$/;

export type LoginNameValidation =
  | { ok: true; normalized: string }
  | { ok: false; code: 'invalid' | 'reserved' | 'too_short' };

export function normalizeLoginName(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Local part before `@` only; strips invalid characters (no slug segment in mailbox). */
export function sanitizeStaffLoginInput(raw: string): string {
  const part = raw.trim().split('@')[0]?.trim() ?? '';
  return normalizeLoginName(part).replace(/[^a-z0-9_-]/g, '');
}

export function validateLoginName(raw: string): LoginNameValidation {
  const normalized = normalizeLoginName(raw);
  if (normalized.length < 3) return { ok: false, code: 'too_short' };
  if (!LOGIN_NAME_RE.test(normalized)) return { ok: false, code: 'invalid' };
  if (RESERVED_LOGIN_NAMES.has(normalized)) return { ok: false, code: 'reserved' };
  return { ok: true, normalized };
}

function hashAlphanumeric(input: string, len: number): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0).toString(36);
  const v = (Math.imul(h, 31) >>> 0).toString(36);
  return (u + v).replace(/[^a-z0-9]/g, '').slice(0, len).padEnd(len, '0');
}

/**
 * Suggest a login_name local-part from display name (Latin: de-accent + strip;
 * CJK / empty Latin: role prefix + stable hash). Does not include @ or domain.
 * If `taken` is set, appends suffix until unused (cap iterations).
 */
export function suggestLoginNameFromDisplay(
  displayName: string,
  role: StaffRole,
  taken?: ReadonlySet<string>,
): string {
  const raw = displayName.trim().split('@')[0]?.trim() ?? '';
  const latin = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);

  const tag =
    role === 'waiter' ? 'w' : role === 'cashier' ? 'c' : role === 'frontdesk' ? 'f' : 'k';
  let candidate =
    latin.length >= 3
      ? latin
      : `${tag}${hashAlphanumeric(raw || role, 8)}`;

  if (RESERVED_LOGIN_NAMES.has(candidate)) {
    candidate = `${candidate}${hashAlphanumeric(raw + role, 2)}`.slice(0, 32);
  }

  if (candidate.length < 3) {
    candidate = `u${hashAlphanumeric(raw + role, 10)}`.slice(0, 12);
  }

  const ensureValid = (s: string): string => {
    let x = s.slice(0, 32);
    if (!/^[a-z0-9]/.test(x)) x = `u${x}`.slice(0, 32);
    if (!/[a-z0-9]$/.test(x)) x = `${x}0`.slice(0, 32);
    return x;
  };

  candidate = ensureValid(candidate);
  let v = validateLoginName(candidate);
  if (!v.ok) {
    candidate = ensureValid(`${tag}${hashAlphanumeric(raw + role, 10)}`);
    v = validateLoginName(candidate);
  }
  if (!v.ok) {
    candidate = ensureValid(`u${hashAlphanumeric(`${raw}:${role}:${Date.now()}`, 11)}`);
    v = validateLoginName(candidate);
  }
  candidate = v.ok ? v.normalized : 'usr000099';

  if (taken?.has(candidate)) {
    for (let i = 0; i < 20; i++) {
      const suffix = hashAlphanumeric(`${raw}-${i}-${role}`, 3);
      const next = ensureValid(`${candidate.slice(0, 28)}${suffix}`.slice(0, 32));
      const val = validateLoginName(next);
      if (val.ok && !taken.has(val.normalized)) {
        candidate = val.normalized;
        break;
      }
    }
  }

  return candidate;
}

/** Supabase Auth internal identifier — not shown in product UI. */
export function buildStaffEmail(loginName: string): string {
  const ln = normalizeLoginName(loginName);
  return `${ln}@${STAFF_EMAIL_DOMAIN}`;
}

/**
 * Legacy single-store auth metadata. **Write-only** in batch 1 (rollback compatibility,
 * multi-store plan §5.4): every staff write mirrors it, nothing reads it — reads go to
 * `staff_identities` / membership rows. Stop writing at contract stage.
 */
export type StaffUserMetadata = {
  account_type: 'staff';
  must_change_password?: boolean;
  staff_role: StaffRole;
  restaurant_id: string;
  staff_account_id: string;
  restaurant_slug: string;
};
