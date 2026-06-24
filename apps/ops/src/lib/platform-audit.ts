import type { SupabaseClient } from '@supabase/supabase-js';

export type AuditInsert = {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  restaurantId?: string | null;
  metadata?: Record<string, unknown>;
};

export const PLATFORM_AUDIT_ACTION_LABELS: Record<string, string> = {
  'restaurant.create': '创建餐厅',
  'owner.reset_password': '重置店主密码',
  'ops.login': '运营登录',
  'ops.bootstrap_admin': 'Bootstrap 首个运营账号',
  'device.revoke': '吊销打印设备',
  'pairing.revoke': '吊销配对码',
  'restaurant.suspend': '暂停餐厅',
  'restaurant.resume': '恢复餐厅',
  'restaurant.update': '更新餐厅信息',
  'platform_admin.create': '创建运营账号',
  'platform_admin.disable': '停用运营账号',
  'platform_admin.enable': '启用运营账号',
  'platform_admin.role_change': '变更运营角色',
  'staff.disable': '停用员工账号',
  'staff.enable': '启用员工账号',
};

export function platformAuditActionLabel(action: string): string {
  return PLATFORM_AUDIT_ACTION_LABELS[action] || action;
}

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
