import { auditMoney } from '@/lib/audit/money';
import type { AuditEventDefinition } from '@/lib/audit/types';
import { AUDIT_EVENT } from '@/lib/audit/types';
import type { OrderItemStatus } from '@/types';

export type ItemQtyDecrementedAuditContext = {
  orderId: string;
  sessionId: string | null;
  tableId: string | null;
  tableName: string | null;
  itemIndex: number;
  itemId: string;
  itemName: string;
  itemStatusBefore: OrderItemStatus;
  qtyBefore: number;
  qtyAfter: number;
  unitAmount: number;
};

export const itemQtyDecrementedDefinition: AuditEventDefinition<ItemQtyDecrementedAuditContext> = {
  actionType: AUDIT_EVENT.ITEM_QTY_DECREMENTED,
  entityType: 'order',
  createsAbnormal: false,
  build(context) {
    const unitAmount = auditMoney(context.unitAmount);
    return {
      entityId: context.orderId,
      orderId: context.orderId,
      sessionId: context.sessionId,
      tableId: context.tableId,
      tableName: context.tableName,
      amountImpact: unitAmount,
      beforeData: {
        itemIndex: context.itemIndex,
        itemId: context.itemId,
        itemName: context.itemName,
        itemStatus: context.itemStatusBefore,
        qty: context.qtyBefore,
        unitAmount,
      },
      afterData: {
        qty: context.qtyAfter,
        qtyRemoved: 1,
        unitAmount,
      },
    };
  },
};
