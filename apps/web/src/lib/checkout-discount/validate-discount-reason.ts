import { validateRequiredAbnormalReason } from '@/lib/audit/validate-abnormal-reason';
import type { AbnormalReasonValidationResult } from '@/lib/audit/validate-abnormal-reason';

export type DiscountReasonValidationResult = AbnormalReasonValidationResult;

export function validateDiscountReason(
  discountRate: number,
  reason: string | null | undefined,
  reasonDetail: string | null | undefined,
): DiscountReasonValidationResult {
  const rate = Math.min(100, Math.max(0, discountRate));
  if (rate <= 0) {
    return { ok: true };
  }

  return validateRequiredAbnormalReason('discount', reason, reasonDetail);
}
