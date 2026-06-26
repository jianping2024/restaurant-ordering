import { lineTotal } from '@/lib/cart-totals';
import { riskLevelForVoidedItem } from '@/lib/abnormal-operations/owner-query';
import { auditMoney } from '@/lib/audit/money';
import type { AuditEventDefinition } from '@/lib/audit/types';
import { AUDIT_EVENT } from '@/lib/audit/types';
import type { OrderItemStatus } from '@/types';

export type ItemDeletedAuditContext = {
  orderId: string;
  sessionId: string | null;
  tableId: string | null;
  tableName: string | null;
  itemIndex: number;
  itemId: string;
  itemName: string;
  itemStatusBefore: OrderItemStatus;
  qty: number;
  lineAmount: number;
};

export const itemDeletedDefinition: AuditEventDefinition<ItemDeletedAuditContext> = {
  actionType: AUDIT_EVENT.ITEM_DELETED,
  entityType: 'order',
  createsAbnormal: true,
  build(context) {
    const amountImpact = auditMoney(context.lineAmount);
    return {
      entityId: context.orderId,
      orderId: context.orderId,
      sessionId: context.sessionId,
      tableId: context.tableId,
      tableName: context.tableName,
      amountImpact,
      abnormalType: 'ITEM_DELETED',
      riskLevel: riskLevelForVoidedItem(context.itemStatusBefore),
      beforeData: {
        itemIndex: context.itemIndex,
        itemId: context.itemId,
        itemName: context.itemName,
        itemStatus: context.itemStatusBefore,
        qty: context.qty,
        lineAmount: amountImpact,
      },
      afterData: {
        itemStatus: 'voided',
        amountImpact,
      },
    };
  },
};

export function itemLineAmount(item: { price?: number; qty?: number }): number {
  return auditMoney(lineTotal(item));
}
