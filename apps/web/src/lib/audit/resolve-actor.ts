import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditActor } from '@/lib/audit/types';

export function staffAuditActor(
  userId: string,
  displayName: string,
  role: string,
): AuditActor {
  return { kind: 'staff', userId, displayName, role };
}

/** Operator label for staff audits: login name (never role name/label). */
export function resolveStaffOperatorDisplayName(account: {
  login_name?: string | null;
  display_name?: string | null;
}): string {
  const login = account.login_name?.trim();
  if (login) return login;
  const display = account.display_name?.trim();
  if (display) return display;
  return '';
}

/** Auth email local-part — last resort when staff row has no display/login name. */
export async function resolveOperatorUsernameFromAuthUser(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email?.split('@')[0]?.trim() || '';
}

export async function loadStaffAuditActor(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string; role: string },
): Promise<AuditActor> {
  const { data: account } = await admin
    .from('restaurant_staff_accounts')
    .select('login_name, display_name')
    .eq('restaurant_id', params.restaurantId)
    .eq('user_id', params.userId)
    .maybeSingle();

  let displayName = resolveStaffOperatorDisplayName({
    login_name: account?.login_name as string | null | undefined,
    display_name: account?.display_name as string | null | undefined,
  });
  if (!displayName) {
    displayName = await resolveOperatorUsernameFromAuthUser(admin, params.userId);
  }
  if (!displayName) displayName = '—';

  if (params.role === 'owner') {
    return ownerAuditActor(params.userId, displayName);
  }
  return staffAuditActor(params.userId, displayName, params.role);
}

export function auditOperatorRole(actor: AuditActor): string {
  if (actor.kind === 'staff') return actor.role;
  return actor.kind;
}

export function ownerAuditActor(userId: string, displayName: string): AuditActor {
  return { kind: 'owner', userId, displayName };
}

export function frontdeskAuditActor(userId: string, displayName: string): AuditActor {
  return { kind: 'frontdesk', userId, displayName };
}

export function resolveOwnerOperatorName(
  restaurantName: string,
  email: string | undefined,
): string {
  const fromEmail = email?.split('@')[0]?.trim();
  if (fromEmail) return fromEmail;
  return restaurantName.trim() || 'Owner';
}
