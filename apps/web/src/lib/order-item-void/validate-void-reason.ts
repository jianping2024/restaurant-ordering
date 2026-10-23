import { validateRequiredAbnormalReason } from '@/lib/audit/validate-abnormal-reason';
import type { AbnormalReasonValidationResult } from '@/lib/audit/validate-abnormal-reason';
import type { NewlyVoidedItem } from '@/lib/order-item-void/detect-newly-voided';
import { isMenuCatalogItem } from '@/lib/order-items';

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
    // Served-dish void needs a detail; take-away charges are not dishes (cashier × removal).
    voidItemWasServed: newlyVoided.some(
      (row) => row.statusBefore === 'done' && isMenuCatalogItem(row.before),
    ),
  });
}
