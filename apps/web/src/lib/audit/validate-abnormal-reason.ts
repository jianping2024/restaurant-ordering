import {
  isValidAbnormalReason,
  requiresAbnormalReasonDetail,
  type AbnormalReasonGroup,
} from '@/lib/audit/reasons';

export type AbnormalReasonValidationResult =
  | { ok: true }
  | { ok: false; code: 'reason_required' | 'invalid_reason' | 'reason_detail_required' };

export function validateRequiredAbnormalReason(
  group: AbnormalReasonGroup,
  reason: string | null | undefined,
  reasonDetail: string | null | undefined,
  options?: { voidItemWasServed?: boolean },
): AbnormalReasonValidationResult {
  const trimmedReason = reason?.trim() ?? '';
  if (!trimmedReason) {
    return { ok: false, code: 'reason_required' };
  }
  if (!isValidAbnormalReason(group, trimmedReason)) {
    return { ok: false, code: 'invalid_reason' };
  }
  if (
    requiresAbnormalReasonDetail(group, trimmedReason, {
      voidItemWasServed: options?.voidItemWasServed,
    }) &&
    !reasonDetail?.trim()
  ) {
    return { ok: false, code: 'reason_detail_required' };
  }

  return { ok: true };
}
