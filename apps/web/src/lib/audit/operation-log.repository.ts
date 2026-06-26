import type { SupabaseClient } from '@supabase/supabase-js';

export type InsertOperationLogInput = {
  restaurant_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  operator_id: string;
  operator_name: string;
  operator_role: string;
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  reason?: string | null;
  reason_detail?: string | null;
  ip_address?: string | null;
  device_info?: string | null;
};

export async function insertOperationLog(
  admin: SupabaseClient,
  input: InsertOperationLogInput,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await admin
    .from('operation_logs')
    .insert({
      restaurant_id: input.restaurant_id,
      action_type: input.action_type,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      operator_id: input.operator_id,
      operator_name: input.operator_name,
      operator_role: input.operator_role,
      before_data: input.before_data,
      after_data: input.after_data,
      reason: input.reason ?? null,
      reason_detail: input.reason_detail ?? null,
      ip_address: input.ip_address ?? null,
      device_info: input.device_info ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error || !data?.id) {
    return { ok: false, message: error?.message ?? 'insert_failed' };
  }

  return { ok: true, id: data.id as string };
}
