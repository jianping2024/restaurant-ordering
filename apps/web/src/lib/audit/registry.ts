import {
  abnormalConfirmedDefinition,
  abnormalIgnoredDefinition,
  abnormalNoteAddedDefinition,
} from '@/lib/audit/builders/abnormal-owner-action';
import { discountAppliedDefinition } from '@/lib/audit/builders/discount-applied';
import { itemDeletedDefinition } from '@/lib/audit/builders/item-deleted';
import { itemQtyDecrementedDefinition } from '@/lib/audit/builders/item-qty-decremented';
import { unpaidTableClosedDefinition } from '@/lib/audit/builders/unpaid-table-closed';
import type { AuditEventDefinition } from '@/lib/audit/types';
import { AUDIT_EVENT, type AuditEventKey } from '@/lib/audit/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Record<AuditEventKey, AuditEventDefinition<any>> = {
  [AUDIT_EVENT.UNPAID_TABLE_CLOSED]: unpaidTableClosedDefinition,
  [AUDIT_EVENT.ITEM_DELETED]: itemDeletedDefinition,
  [AUDIT_EVENT.ITEM_QTY_DECREMENTED]: itemQtyDecrementedDefinition,
  [AUDIT_EVENT.DISCOUNT_APPLIED]: discountAppliedDefinition,
  [AUDIT_EVENT.ABNORMAL_CONFIRMED]: abnormalConfirmedDefinition,
  [AUDIT_EVENT.ABNORMAL_IGNORED]: abnormalIgnoredDefinition,
  [AUDIT_EVENT.ABNORMAL_NOTE_ADDED]: abnormalNoteAddedDefinition,
};

export function getAuditEventDefinition(key: AuditEventKey): AuditEventDefinition<unknown> | null {
  return REGISTRY[key] ?? null;
}
