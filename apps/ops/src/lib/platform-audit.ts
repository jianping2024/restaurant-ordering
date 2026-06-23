import type { SupabaseClient } from '@supabase/supabase-js';

export type AuditInsert = {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  restaurantId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writePlatformAudit(
  admin: SupabaseClient,
  entry: AuditInsert,
): Promise<void> {
  const { error } = await admin.from('platform_admin_audit_log').insert({
    actor_user_id: entry.actorUserId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    restaurant_id: entry.restaurantId ?? null,
    metadata: entry.metadata ?? {},
  });
  if (error) {
    console.error('platform_audit_insert_failed', error.message);
  }
}
