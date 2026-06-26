import type { AuditEventDefinition } from '@/lib/audit/types';
import { AUDIT_EVENT } from '@/lib/audit/types';
import type {
  AbnormalOperationStatus,
  AbnormalOperationType,
} from '@/lib/abnormal-operations/types';

export type AbnormalOwnerActionContext = {
  abnormalOperationId: string;
  abnormalType: AbnormalOperationType;
  previousStatus: AbnormalOperationStatus;
  nextStatus: AbnormalOperationStatus;
  previousOwnerNote: string | null;
  nextOwnerNote: string | null;
};

function buildPayload(context: AbnormalOwnerActionContext) {
  return {
    entityId: context.abnormalOperationId,
    amountImpact: 0,
    beforeData: {
      abnormalType: context.abnormalType,
      status: context.previousStatus,
      owner_note: context.previousOwnerNote,
    },
    afterData: {
      status: context.nextStatus,
      owner_note: context.nextOwnerNote,
    },
  };
}

export const abnormalConfirmedDefinition: AuditEventDefinition<AbnormalOwnerActionContext> = {
  actionType: AUDIT_EVENT.ABNORMAL_CONFIRMED,
  entityType: 'abnormal_operation',
  createsAbnormal: false,
  build: buildPayload,
};

export const abnormalIgnoredDefinition: AuditEventDefinition<AbnormalOwnerActionContext> = {
  actionType: AUDIT_EVENT.ABNORMAL_IGNORED,
  entityType: 'abnormal_operation',
  createsAbnormal: false,
  build: buildPayload,
};

export const abnormalNoteAddedDefinition: AuditEventDefinition<AbnormalOwnerActionContext> = {
  actionType: AUDIT_EVENT.ABNORMAL_NOTE_ADDED,
  entityType: 'abnormal_operation',
  createsAbnormal: false,
  build: buildPayload,
};
