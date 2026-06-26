import {
  isValidAbnormalReason,
  requiresAbnormalReasonDetail,
} from '@/lib/audit/reasons';
import type { NewlyVoidedItem } from '@/lib/order-item-void/detect-newly-voided';

export type VoidReasonValidationResult =
  | { ok: true }
  | { ok: false; code: 'reason_required' | 'invalid_reason' | 'reason_detail_required' };

export function validateVoidItemReason(
  newlyVoided: NewlyVoidedItem[],
  reason: string | null | undefined,
  reasonDetail: string | null | undefined,
): VoidReasonValidationResult {
  if (newlyVoided.length === 0) {
    return { ok: true };
  }

  const trimmedReason = reason?.trim() ?? '';
  if (!trimmedReason) {
    return { ok: false, code: 'reason_required' };
  }
  if (!isValidAbnormalReason('void_item', trimmedReason)) {
    return { ok: false, code: 'invalid_reason' };
  }

  const needsDetail = newlyVoided.some((row) =>
    requiresAbnormalReasonDetail('void_item', trimmedReason, {
      voidItemWasServed: row.statusBefore === 'done',
    }),
  );
  if (needsDetail && !reasonDetail?.trim()) {
    return { ok: false, code: 'reason_detail_required' };
  }

  return { ok: true };
}
