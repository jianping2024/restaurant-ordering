export const ABNORMAL_OPERATION_MAX_RANGE_DAYS = 31;
export const ABNORMAL_OPERATION_MAX_LOOKBACK_DAYS = 90;

export type AbnormalReasonGroup = 'discount' | 'void_item' | 'unpaid_close';

export const DISCOUNT_REASONS = [
  'customer_complaint',
  'owner_approved',
  'dish_issue',
  'service_issue',
  'regular_guest',
  'other',
] as const;

export const VOID_ITEM_REASONS = [
  'customer_mistake',
  'staff_mistake',
  'duplicate',
  'sold_out',
  'kitchen_cannot_make',
  'customer_cancelled',
  'qty_adjustment',
  'other',
] as const;

export const UNPAID_CLOSE_REASONS = [
  'left_unpaid',
  'owner_approved',
  'test_order',
  'duplicate_session',
  'operation_error',
  'special_case',
  'other',
] as const;

export type DiscountReason = (typeof DISCOUNT_REASONS)[number];
export type VoidItemReason = (typeof VOID_ITEM_REASONS)[number];
export type UnpaidCloseReason = (typeof UNPAID_CLOSE_REASONS)[number];

/** Waiter table detail minus-one; written server-side without a reason dialog. */
export const VOID_ITEM_QTY_ADJUSTMENT_REASON: VoidItemReason = 'qty_adjustment';

const REASON_SETS: Record<AbnormalReasonGroup, readonly string[]> = {
  discount: DISCOUNT_REASONS,
  void_item: VOID_ITEM_REASONS,
  unpaid_close: UNPAID_CLOSE_REASONS,
};

export function isValidAbnormalReason(group: AbnormalReasonGroup, reason: string): boolean {
  return (REASON_SETS[group] as readonly string[]).includes(reason);
}

/** When true, `reason_detail` must be non-empty. */
export function requiresAbnormalReasonDetail(
  group: AbnormalReasonGroup,
  reason: string,
  options?: { voidItemWasServed?: boolean },
): boolean {
  if (reason === 'other') return true;
  if (group === 'void_item' && options?.voidItemWasServed) return true;
  return false;
}
