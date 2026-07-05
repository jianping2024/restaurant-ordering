import type { AuditEventDefinition } from '@/lib/audit/types';
import { AUDIT_EVENT } from '@/lib/audit/types';
import {
  buildItemVoidAuditPayload,
  type ItemVoidAuditContext,
} from '@/lib/audit/builders/item-void-audit-payload';

export type ItemVoidedAuditContext = ItemVoidAuditContext;

export const itemVoidedDefinition: AuditEventDefinition<ItemVoidedAuditContext> = {
  actionType: AUDIT_EVENT.ITEM_VOIDED,
  entityType: 'order',
  createsAbnormal: false,
  build: buildItemVoidAuditPayload,
};
