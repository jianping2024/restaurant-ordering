import type { AbnormalOperationType, AbnormalRiskLevel } from '@/lib/abnormal-operations/types';

export const AUDIT_EVENT = {
  UNPAID_TABLE_CLOSED: 'UNPAID_TABLE_CLOSED',
  ITEM_DELETED: 'ITEM_DELETED',
  ITEM_QTY_DECREMENTED: 'ITEM_QTY_DECREMENTED',
  DISCOUNT_APPLIED: 'DISCOUNT_APPLIED',
  ABNORMAL_CONFIRMED: 'ABNORMAL_CONFIRMED',
  ABNORMAL_IGNORED: 'ABNORMAL_IGNORED',
  ABNORMAL_NOTE_ADDED: 'ABNORMAL_NOTE_ADDED',
} as const;

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
  reason: string;
  reasonDetail?: string | null;
  meta?: { ipAddress?: string | null; deviceInfo?: string | null };
};

export type RecordAuditResult = {
  operationLogId?: string;
  abnormalOperationId?: string;
  warnings: string[];
};
