import { lineTotal } from '@/lib/cart-totals';
import { auditMoney } from '@/lib/audit/money';
import type { AuditBuiltPayload } from '@/lib/audit/types';
import type { OrderItemStatus } from '@/types';

export type ItemVoidAuditContext = {
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

export function itemLineAmount(item: { price?: number; qty?: number }): number {
  return auditMoney(lineTotal(item));
}

export function buildItemVoidAuditPayload(context: ItemVoidAuditContext): AuditBuiltPayload {
  const amountImpact = auditMoney(context.lineAmount);
  return {
    entityId: context.orderId,
    orderId: context.orderId,
    sessionId: context.sessionId,
    tableId: context.tableId,
    tableName: context.tableName,
    amountImpact,
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
}
