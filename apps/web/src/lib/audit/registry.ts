import {
  abnormalConfirmedDefinition,
  abnormalIgnoredDefinition,
  abnormalNoteAddedDefinition,
} from '@/lib/audit/builders/abnormal-owner-action';
import { discountAppliedDefinition } from '@/lib/audit/builders/discount-applied';
import { itemDeletedDefinition } from '@/lib/audit/builders/item-deleted';
import { itemQtyDecrementedDefinition } from '@/lib/audit/builders/item-qty-decremented';
import { itemVoidedDefinition } from '@/lib/audit/builders/item-voided';
import {
  checkoutRequestedDefinition,
  guestCountChangedDefinition,
  kitchenPrepDefinition,
  kitchenPrepReprintDefinition,
  kitchenServeDefinition,
  orderAppendedDefinition,
  paymentConfirmedDefinition,
  sessionOpenedDefinition,
  tableClosedDefinition,
  tableMergedDefinition,
  tablePartyDefinition,
  tableTransferredDefinition,
} from '@/lib/audit/builders/staff-operations';
import { unpaidTableClosedDefinition } from '@/lib/audit/builders/unpaid-table-closed';
import type { AuditEventDefinition } from '@/lib/audit/types';
import { AUDIT_EVENT, type AuditEventKey } from '@/lib/audit/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Record<AuditEventKey, AuditEventDefinition<any>> = {
  [AUDIT_EVENT.UNPAID_TABLE_CLOSED]: unpaidTableClosedDefinition,
  [AUDIT_EVENT.ITEM_DELETED]: itemDeletedDefinition,
  [AUDIT_EVENT.ITEM_VOIDED]: itemVoidedDefinition,
  [AUDIT_EVENT.ITEM_QTY_DECREMENTED]: itemQtyDecrementedDefinition,
  [AUDIT_EVENT.DISCOUNT_APPLIED]: discountAppliedDefinition,
  [AUDIT_EVENT.ABNORMAL_CONFIRMED]: abnormalConfirmedDefinition,
  [AUDIT_EVENT.ABNORMAL_IGNORED]: abnormalIgnoredDefinition,
  [AUDIT_EVENT.ABNORMAL_NOTE_ADDED]: abnormalNoteAddedDefinition,
  [AUDIT_EVENT.SESSION_OPENED]: sessionOpenedDefinition,
  [AUDIT_EVENT.GUEST_COUNT_CHANGED]: guestCountChangedDefinition,
  [AUDIT_EVENT.TABLE_CLOSED]: tableClosedDefinition,
  [AUDIT_EVENT.TABLE_TRANSFERRED]: tableTransferredDefinition,
  [AUDIT_EVENT.TABLE_MERGED]: tableMergedDefinition,
  [AUDIT_EVENT.TABLE_PARTY]: tablePartyDefinition,
  [AUDIT_EVENT.CHECKOUT_REQUESTED]: checkoutRequestedDefinition,
  [AUDIT_EVENT.PAYMENT_CONFIRMED]: paymentConfirmedDefinition,
  [AUDIT_EVENT.ORDER_APPENDED]: orderAppendedDefinition,
  [AUDIT_EVENT.KITCHEN_PREP]: kitchenPrepDefinition,
  [AUDIT_EVENT.KITCHEN_PREP_REPRINT]: kitchenPrepReprintDefinition,
  [AUDIT_EVENT.KITCHEN_SERVE]: kitchenServeDefinition,
};

export function getAuditEventDefinition(key: AuditEventKey): AuditEventDefinition<unknown> | null {
  return REGISTRY[key] ?? null;
}
