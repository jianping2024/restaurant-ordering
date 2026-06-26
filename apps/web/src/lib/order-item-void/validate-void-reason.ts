import { validateRequiredAbnormalReason } from '@/lib/audit/validate-abnormal-reason';
import type { AbnormalReasonValidationResult } from '@/lib/audit/validate-abnormal-reason';
import type { NewlyVoidedItem } from '@/lib/order-item-void/detect-newly-voided';

export type VoidReasonValidationResult = AbnormalReasonValidationResult;

export function validateVoidItemReason(
  newlyVoided: NewlyVoidedItem[],
  reason: string | null | undefined,
  reasonDetail: string | null | undefined,
): VoidReasonValidationResult {
  if (newlyVoided.length === 0) {
    return { ok: true };
  }

  return validateRequiredAbnormalReason('void_item', reason, reasonDetail, {
    voidItemWasServed: newlyVoided.some((row) => row.statusBefore === 'done'),
  });
}
