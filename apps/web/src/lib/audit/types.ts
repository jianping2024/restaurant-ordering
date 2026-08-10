import type { AbnormalOperationType, AbnormalRiskLevel } from '@/lib/abnormal-operations/types';

export const AUDIT_EVENT = {
  UNPAID_TABLE_CLOSED: 'UNPAID_TABLE_CLOSED',
  ITEM_DELETED: 'ITEM_DELETED',
  ITEM_VOIDED: 'ITEM_VOIDED',
  ITEM_QTY_DECREMENTED: 'ITEM_QTY_DECREMENTED',
  DISCOUNT_APPLIED: 'DISCOUNT_APPLIED',
  ABNORMAL_CONFIRMED: 'ABNORMAL_CONFIRMED',
  ABNORMAL_IGNORED: 'ABNORMAL_IGNORED',
  ABNORMAL_NOTE_ADDED: 'ABNORMAL_NOTE_ADDED',
  /** Staff operation log (dashboard list). */
  SESSION_OPENED: 'SESSION_OPENED',
  TABLE_CLOSED: 'TABLE_CLOSED',
  TABLE_TRANSFERRED: 'TABLE_TRANSFERRED',
  TABLE_MERGED: 'TABLE_MERGED',
  CHECKOUT_REQUESTED: 'CHECKOUT_REQUESTED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  KITCHEN_PREP: 'KITCHEN_PREP',
  KITCHEN_PREP_REPRINT: 'KITCHEN_PREP_REPRINT',
  KITCHEN_SERVE: 'KITCHEN_SERVE',
} as const;

/** Sole action_type set shown/filtered on 操作记录 (subset of AUDIT_EVENT). */
export const OPERATION_LOG_ACTION_TYPES = [
  AUDIT_EVENT.SESSION_OPENED,
  AUDIT_EVENT.TABLE_CLOSED,
  AUDIT_EVENT.UNPAID_TABLE_CLOSED,
  AUDIT_EVENT.TABLE_TRANSFERRED,
  AUDIT_EVENT.TABLE_MERGED,
  AUDIT_EVENT.CHECKOUT_REQUESTED,
  AUDIT_EVENT.PAYMENT_CONFIRMED,
  AUDIT_EVENT.KITCHEN_PREP,
  AUDIT_EVENT.KITCHEN_PREP_REPRINT,
  AUDIT_EVENT.KITCHEN_SERVE,
] as const;

export type OperationLogActionType = (typeof OPERATION_LOG_ACTION_TYPES)[number];

export function isOperationLogActionType(value: string): value is OperationLogActionType {
  return (OPERATION_LOG_ACTION_TYPES as readonly string[]).includes(value);
}

export type AuditEventKey = (typeof AUDIT_EVENT)[keyof typeof AUDIT_EVENT];

export type AuditEntityType = 'table_session' | 'order' | 'bill_split' | 'abnormal_operation';

export type AuditActor =
  | { kind: 'owner'; userId: string; displayName: string }
  | { kind: 'frontdesk'; userId: string; displayName: string }
  | { kind: 'staff'; userId: string; displayName: string; role: string };

export type AuditBuiltPayload = {
  entityId: string;
  amountImpact: number;
  beforeData: Record<string, unknown>;
  afterData: Record<string, unknown>;
  orderId?: string | null;
  sessionId?: string | null;
  tableId?: string | null;
  tableName?: string | null;
  abnormalType?: AbnormalOperationType;
  riskLevel?: AbnormalRiskLevel;
};

export type AuditEventDefinition<TContext> = {
  actionType: AuditEventKey;
  entityType: AuditEntityType;
  createsAbnormal: boolean;
  build: (context: TContext) => AuditBuiltPayload;
};

export type RecordAuditInput<TContext> = {
  restaurantId: string;
  actor: AuditActor;
  context: TContext;
  /** Required when createsAbnormal; optional for staff operation logs. */
  reason?: string | null;
  reasonDetail?: string | null;
  meta?: { ipAddress?: string | null; deviceInfo?: string | null };
};

export type RecordAuditResult = {
  operationLogId?: string;
  abnormalOperationId?: string;
  warnings: string[];
};
