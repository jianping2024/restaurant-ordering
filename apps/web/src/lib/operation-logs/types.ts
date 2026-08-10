import type { OperationLogActionType } from '@/lib/audit/types';

/** Sole DB/API row shape for 操作记录. */
export type OperationLogRow = {
  id: string;
  restaurant_id: string;
  action_type: OperationLogActionType;
  entity_type: string;
  entity_id: string;
  operator_id: string;
  operator_name: string;
  operator_role: string;
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  reason: string | null;
  reason_detail: string | null;
  created_at: string;
};
