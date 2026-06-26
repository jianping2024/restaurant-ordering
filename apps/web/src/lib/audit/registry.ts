import { itemDeletedDefinition } from '@/lib/audit/builders/item-deleted';
import { unpaidTableClosedDefinition } from '@/lib/audit/builders/unpaid-table-closed';
import type { AuditEventDefinition } from '@/lib/audit/types';
import { AUDIT_EVENT, type AuditEventKey } from '@/lib/audit/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Record<AuditEventKey, AuditEventDefinition<any>> = {
  [AUDIT_EVENT.UNPAID_TABLE_CLOSED]: unpaidTableClosedDefinition,
  [AUDIT_EVENT.ITEM_DELETED]: itemDeletedDefinition,
  [AUDIT_EVENT.DISCOUNT_APPLIED]: {
    actionType: AUDIT_EVENT.DISCOUNT_APPLIED,
    entityType: 'bill_split',
    createsAbnormal: true,
    build: () => {
      throw new Error('DISCOUNT_APPLIED audit not registered for P1');
    },
  },
  [AUDIT_EVENT.ABNORMAL_CONFIRMED]: {
    actionType: AUDIT_EVENT.ABNORMAL_CONFIRMED,
    entityType: 'abnormal_operation',
    createsAbnormal: false,
    build: () => {
      throw new Error('ABNORMAL_CONFIRMED audit not registered for P1');
    },
  },
  [AUDIT_EVENT.ABNORMAL_IGNORED]: {
    actionType: AUDIT_EVENT.ABNORMAL_IGNORED,
    entityType: 'abnormal_operation',
    createsAbnormal: false,
    build: () => {
      throw new Error('ABNORMAL_IGNORED audit not registered for P1');
    },
  },
  [AUDIT_EVENT.ABNORMAL_NOTE_ADDED]: {
    actionType: AUDIT_EVENT.ABNORMAL_NOTE_ADDED,
    entityType: 'abnormal_operation',
    createsAbnormal: false,
    build: () => {
      throw new Error('ABNORMAL_NOTE_ADDED audit not registered for P1');
    },
  },
};

export function getAuditEventDefinition(key: AuditEventKey): AuditEventDefinition<unknown> | null {
  return REGISTRY[key] ?? null;
}
