import { auditMoney } from '@/lib/audit/money';
import type { AuditEventDefinition } from '@/lib/audit/types';
import { AUDIT_EVENT } from '@/lib/audit/types';

export type UnpaidTableClosedAuditContext = {
  sessionId: string;
  tableId: string;
  tableName: string | null;
  sessionStatusBefore: string;
  payableAmount: number;
  paidAmount: number;
  gap: number;
  hasUnpaidSplit: boolean;
};

export const unpaidTableClosedDefinition: AuditEventDefinition<UnpaidTableClosedAuditContext> = {
  actionType: AUDIT_EVENT.UNPAID_TABLE_CLOSED,
  entityType: 'table_session',
  createsAbnormal: true,
  build(context) {
    const gap = auditMoney(context.gap);
    return {
      entityId: context.sessionId,
      sessionId: context.sessionId,
      tableId: context.tableId,
      tableName: context.tableName,
      amountImpact: gap,
      abnormalType: 'UNPAID_TABLE_CLOSED',
      riskLevel: 'HIGH',
      beforeData: {
        sessionStatus: context.sessionStatusBefore,
        tableStatus: context.sessionStatusBefore,
        payableAmount: auditMoney(context.payableAmount),
        paidAmount: auditMoney(context.paidAmount),
        gap,
        hasUnpaidSplit: context.hasUnpaidSplit,
      },
      afterData: {
        sessionStatus: 'closed',
        tableStatus: 'closed',
        amountImpact: gap,
      },
    };
  },
};
