import type { SupabaseClient } from '@supabase/supabase-js';
import type { StaffRole } from '@/lib/staff-account';
import type { AuditActor } from '@/lib/audit/types';

export function staffAuditActor(
  userId: string,
  displayName: string,
  role: StaffRole,
): AuditActor {
  return { kind: 'staff', userId, displayName, role };
}

export async function loadStaffAuditActor(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string; role: StaffRole },
): Promise<AuditActor> {
  const { data: account } = await admin
    .from('restaurant_staff_accounts')
    .select('display_name')
    .eq('restaurant_id', params.restaurantId)
    .eq('user_id', params.userId)
    .maybeSingle();

  const displayName =
    (account?.display_name as string | undefined)?.trim() || params.role;
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
