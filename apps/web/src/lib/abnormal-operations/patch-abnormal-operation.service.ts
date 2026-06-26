import type { SupabaseClient } from '@supabase/supabase-js';
import { AUDIT_EVENT, recordAudit } from '@/lib/audit';
import type { AbnormalOwnerActionContext } from '@/lib/audit/builders/abnormal-owner-action';
import type { AuditActor } from '@/lib/audit/types';
import {
  getAbnormalOperationById,
  patchAbnormalOperation,
} from '@/lib/abnormal-operations/owner-query';
import type { AbnormalOperationRow, AbnormalOperationStatus } from '@/lib/abnormal-operations/types';

export type PatchAbnormalOperationInput = {
  admin: SupabaseClient;
  restaurantId: string;
  ownerId: string;
  actor: AuditActor;
  id: string;
  status?: AbnormalOperationStatus;
  ownerNote?: string | null;
};

export type PatchAbnormalOperationServiceResult =
  | { ok: true; row: AbnormalOperationRow }
  | { ok: false; code: 'not_found' | 'invalid_status' | 'update_failed'; message?: string };

function auditContext(
  existing: AbnormalOperationRow,
  next: AbnormalOperationRow,
): AbnormalOwnerActionContext {
  return {
    abnormalOperationId: existing.id,
    abnormalType: existing.type,
    previousStatus: existing.status,
    nextStatus: next.status,
    previousOwnerNote: existing.owner_note,
    nextOwnerNote: next.owner_note,
  };
}

export async function patchAbnormalOperationWithAudit(
  input: PatchAbnormalOperationInput,
): Promise<PatchAbnormalOperationServiceResult> {
  const existing = await getAbnormalOperationById(input.admin, input.restaurantId, input.id);
  if (!existing) {
    return { ok: false, code: 'not_found' };
  }

  const result = await patchAbnormalOperation(input.admin, {
    restaurantId: input.restaurantId,
    id: input.id,
    ownerId: input.ownerId,
    status: input.status,
    ownerNote: input.ownerNote,
  });

  if (!result.ok) {
    return result;
  }

  const row = result.row;
  const statusChanged = row.status !== existing.status;
  const noteChanged = row.owner_note !== existing.owner_note;

  if (statusChanged || noteChanged) {
    const context = auditContext(existing, row);
    const auditInput = {
      restaurantId: input.restaurantId,
      actor: input.actor,
      context,
      reason: row.type,
      reasonDetail: null as string | null,
    };

    if (statusChanged && row.status === 'CONFIRMED') {
      await recordAudit(input.admin, AUDIT_EVENT.ABNORMAL_CONFIRMED, auditInput);
    } else if (statusChanged && row.status === 'IGNORED') {
      await recordAudit(input.admin, AUDIT_EVENT.ABNORMAL_IGNORED, auditInput);
    } else if (noteChanged) {
      await recordAudit(input.admin, AUDIT_EVENT.ABNORMAL_NOTE_ADDED, auditInput);
    }
  }

  return { ok: true, row };
}
