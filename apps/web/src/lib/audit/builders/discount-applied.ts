import { riskLevelForDiscountRate } from '@/lib/abnormal-operations/owner-query';
import { auditMoney } from '@/lib/audit/money';
import type { AuditEventDefinition } from '@/lib/audit/types';
import { AUDIT_EVENT } from '@/lib/audit/types';

export type DiscountAppliedAuditContext = {
  billSplitId: string;
  sessionId: string | null;
  tableId: string | null;
  tableName: string | null;
  originalTotal: number;
  discountRate: number;
  discountAmount: number;
  finalTotal: number;
};

export const discountAppliedDefinition: AuditEventDefinition<DiscountAppliedAuditContext> = {
  actionType: AUDIT_EVENT.DISCOUNT_APPLIED,
  entityType: 'bill_split',
  createsAbnormal: true,
  build(context) {
    const originalTotal = auditMoney(context.originalTotal);
    const discountAmount = auditMoney(context.discountAmount);
    const finalTotal = auditMoney(context.finalTotal);
    const discountRate = Math.min(100, Math.max(0, context.discountRate));
    return {
      entityId: context.billSplitId,
      sessionId: context.sessionId,
      tableId: context.tableId,
      tableName: context.tableName,
      amountImpact: discountAmount,
      abnormalType: 'DISCOUNT_APPLIED',
      riskLevel: riskLevelForDiscountRate(discountRate),
      beforeData: {
        billSplitId: context.billSplitId,
        originalTotal,
        discountRate,
      },
      afterData: {
        discountAmount,
        finalTotal,
        amountImpact: discountAmount,
      },
    };
  },
};

export function computeDiscountAmounts(originalTotal: number, discountRate: number) {
  const rate = Math.min(100, Math.max(0, discountRate));
  const original = auditMoney(originalTotal);
  const discountAmount = auditMoney(original * (rate / 100));
  const finalTotal = auditMoney(original - discountAmount);
  return { originalTotal: original, discountRate: rate, discountAmount, finalTotal };
}
