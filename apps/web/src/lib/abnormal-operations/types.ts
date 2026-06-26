export type AbnormalOperationType = 'DISCOUNT_APPLIED' | 'ITEM_DELETED' | 'UNPAID_TABLE_CLOSED';
export type AbnormalRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type AbnormalOperationStatus = 'PENDING' | 'CONFIRMED' | 'IGNORED';

export type AbnormalOperationRow = {
  id: string;
  restaurant_id: string;
  type: AbnormalOperationType;
  risk_level: AbnormalRiskLevel;
  status: AbnormalOperationStatus;
  order_id: string | null;
  session_id: string | null;
  table_id: string | null;
  table_name: string | null;
  operator_id: string;
  operator_name: string;
  operator_role: string;
  amount_impact: number;
  reason: string;
  reason_detail: string | null;
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  owner_note: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  source_action_id: string | null;
  created_at: string;
  updated_at: string;
};
