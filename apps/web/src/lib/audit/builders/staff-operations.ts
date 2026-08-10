import { auditMoney } from '@/lib/audit/money';
import type { AuditEventDefinition } from '@/lib/audit/types';
import { AUDIT_EVENT } from '@/lib/audit/types';

export type KitchenLineAuditItem = {
  itemName: string;
  qty: number;
};

export type SessionOpenedAuditContext = {
  sessionId: string;
  tableName: string;
  adultCount: number;
  childCount: number;
};

export const sessionOpenedDefinition: AuditEventDefinition<SessionOpenedAuditContext> = {
  actionType: AUDIT_EVENT.SESSION_OPENED,
  entityType: 'table_session',
  createsAbnormal: false,
  build(context) {
    return {
      entityId: context.sessionId,
      sessionId: context.sessionId,
      tableName: context.tableName,
      amountImpact: 0,
      beforeData: {},
      afterData: {
        tableName: context.tableName,
        sessionId: context.sessionId,
        adultCount: context.adultCount,
        childCount: context.childCount,
      },
    };
  },
};

export type TableClosedAuditContext = {
  sessionId: string;
  tableName: string;
  closeKind: 'paid' | 'frontdesk';
  amount?: number;
};

export const tableClosedDefinition: AuditEventDefinition<TableClosedAuditContext> = {
  actionType: AUDIT_EVENT.TABLE_CLOSED,
  entityType: 'table_session',
  createsAbnormal: false,
  build(context) {
    const amount = context.amount != null ? auditMoney(context.amount) : undefined;
    return {
      entityId: context.sessionId,
      sessionId: context.sessionId,
      tableName: context.tableName,
      amountImpact: amount ?? 0,
      beforeData: {},
      afterData: {
        tableName: context.tableName,
        sessionId: context.sessionId,
        closeKind: context.closeKind,
        ...(amount != null ? { amount } : {}),
      },
    };
  },
};

export type TableTransferredAuditContext = {
  sessionId: string;
  fromTableName: string;
  toTableName: string;
};

export const tableTransferredDefinition: AuditEventDefinition<TableTransferredAuditContext> = {
  actionType: AUDIT_EVENT.TABLE_TRANSFERRED,
  entityType: 'table_session',
  createsAbnormal: false,
  build(context) {
    return {
      entityId: context.sessionId,
      sessionId: context.sessionId,
      amountImpact: 0,
      beforeData: { fromTableName: context.fromTableName },
      afterData: {
        toTableName: context.toTableName,
        sessionId: context.sessionId,
      },
    };
  },
};

export type TableMergedAuditContext = {
  sessionId: string;
  sourceTableName: string;
  targetTableName: string;
};

export const tableMergedDefinition: AuditEventDefinition<TableMergedAuditContext> = {
  actionType: AUDIT_EVENT.TABLE_MERGED,
  entityType: 'table_session',
  createsAbnormal: false,
  build(context) {
    return {
      entityId: context.sessionId,
      sessionId: context.sessionId,
      amountImpact: 0,
      beforeData: { sourceTableName: context.sourceTableName },
      afterData: {
        targetTableName: context.targetTableName,
        sessionId: context.sessionId,
      },
    };
  },
};

export type CheckoutRequestedAuditContext = {
  billSplitId: string;
  sessionId: string;
  tableName: string;
  splitMode: string;
  totalAmount: number;
};

export const checkoutRequestedDefinition: AuditEventDefinition<CheckoutRequestedAuditContext> = {
  actionType: AUDIT_EVENT.CHECKOUT_REQUESTED,
  entityType: 'bill_split',
  createsAbnormal: false,
  build(context) {
    const totalAmount = auditMoney(context.totalAmount);
    return {
      entityId: context.billSplitId,
      sessionId: context.sessionId,
      tableName: context.tableName,
      amountImpact: totalAmount,
      beforeData: {},
      afterData: {
        tableName: context.tableName,
        sessionId: context.sessionId,
        splitMode: context.splitMode,
        totalAmount,
      },
    };
  },
};

export type PaymentConfirmedAuditContext = {
  billSplitId: string;
  tableName: string;
  personName: string;
  amount: number;
  allPaid: boolean;
  sessionId?: string | null;
};

export const paymentConfirmedDefinition: AuditEventDefinition<PaymentConfirmedAuditContext> = {
  actionType: AUDIT_EVENT.PAYMENT_CONFIRMED,
  entityType: 'bill_split',
  createsAbnormal: false,
  build(context) {
    const amount = auditMoney(context.amount);
    return {
      entityId: context.billSplitId,
      sessionId: context.sessionId ?? null,
      tableName: context.tableName,
      amountImpact: amount,
      beforeData: {},
      afterData: {
        tableName: context.tableName,
        personName: context.personName,
        amount,
        allPaid: context.allPaid,
      },
    };
  },
};

export type KitchenPrepAuditContext = {
  orderId: string;
  tableName: string;
  items: KitchenLineAuditItem[];
};

export const kitchenPrepDefinition: AuditEventDefinition<KitchenPrepAuditContext> = {
  actionType: AUDIT_EVENT.KITCHEN_PREP,
  entityType: 'order',
  createsAbnormal: false,
  build(context) {
    return {
      entityId: context.orderId,
      orderId: context.orderId,
      tableName: context.tableName,
      amountImpact: 0,
      beforeData: {},
      afterData: {
        tableName: context.tableName,
        items: context.items,
      },
    };
  },
};

export const kitchenPrepReprintDefinition: AuditEventDefinition<KitchenPrepAuditContext> = {
  actionType: AUDIT_EVENT.KITCHEN_PREP_REPRINT,
  entityType: 'order',
  createsAbnormal: false,
  build(context) {
    return {
      entityId: context.orderId,
      orderId: context.orderId,
      tableName: context.tableName,
      amountImpact: 0,
      beforeData: {},
      afterData: {
        tableName: context.tableName,
        items: context.items,
      },
    };
  },
};

export type KitchenServeAuditContext = {
  orderId: string;
  tableName: string;
  items: KitchenLineAuditItem[];
};

export const kitchenServeDefinition: AuditEventDefinition<KitchenServeAuditContext> = {
  actionType: AUDIT_EVENT.KITCHEN_SERVE,
  entityType: 'order',
  createsAbnormal: false,
  build(context) {
    return {
      entityId: context.orderId,
      orderId: context.orderId,
      tableName: context.tableName,
      amountImpact: 0,
      beforeData: {},
      afterData: {
        tableName: context.tableName,
        items: context.items,
      },
    };
  },
};
