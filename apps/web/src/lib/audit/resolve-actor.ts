import type { AuditActor } from '@/lib/audit/types';

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
