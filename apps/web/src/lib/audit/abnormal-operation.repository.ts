import type { SupabaseClient } from '@supabase/supabase-js';
import type { AbnormalOperationType, AbnormalRiskLevel } from '@/lib/abnormal-operations/types';

export type InsertAbnormalOperationInput = {
  restaurant_id: string;
  type: AbnormalOperationType;
  risk_level: AbnormalRiskLevel;
  order_id?: string | null;
  session_id?: string | null;
  table_id?: string | null;
  table_name?: string | null;
  operator_id: string;
  operator_name: string;
  operator_role: string;
  amount_impact: number;
  reason: string;
  reason_detail?: string | null;
  before_data?: Record<string, unknown>;
  after_data?: Record<string, unknown>;
  source_action_id?: string | null;
};

export async function insertAbnormalOperationRow(
  admin: SupabaseClient,
  input: InsertAbnormalOperationInput,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await admin
    .from('abnormal_operations')
    .insert({
      restaurant_id: input.restaurant_id,
      type: input.type,
      risk_level: input.risk_level,
      order_id: input.order_id ?? null,
      session_id: input.session_id ?? null,
      table_id: input.table_id ?? null,
      table_name: input.table_name ?? null,
      operator_id: input.operator_id,
      operator_name: input.operator_name,
      operator_role: input.operator_role,
      amount_impact: input.amount_impact,
      reason: input.reason,
      reason_detail: input.reason_detail ?? null,
      before_data: input.before_data ?? {},
      after_data: input.after_data ?? {},
      source_action_id: input.source_action_id ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error || !data?.id) {
    return { ok: false, message: error?.message ?? 'insert_failed' };
  }

  return { ok: true, id: data.id as string };
}
