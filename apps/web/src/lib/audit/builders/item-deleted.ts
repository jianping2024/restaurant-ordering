import { riskLevelForVoidedItem } from '@/lib/abnormal-operations/owner-query';
import type { AuditEventDefinition } from '@/lib/audit/types';
import { AUDIT_EVENT } from '@/lib/audit/types';
import {
  buildItemVoidAuditPayload,
  type ItemVoidAuditContext,
} from '@/lib/audit/builders/item-void-audit-payload';

export type { ItemVoidAuditContext as ItemDeletedAuditContext } from '@/lib/audit/builders/item-void-audit-payload';
export { itemLineAmount } from '@/lib/audit/builders/item-void-audit-payload';

export const itemDeletedDefinition: AuditEventDefinition<ItemVoidAuditContext> = {
  actionType: AUDIT_EVENT.ITEM_DELETED,
  entityType: 'order',
  createsAbnormal: true,
  build(context) {
    return {
      ...buildItemVoidAuditPayload(context),
      abnormalType: 'ITEM_DELETED',
      riskLevel: riskLevelForVoidedItem(context.itemStatusBefore),
    };
  },
};
