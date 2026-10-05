/**
 * Sole toast mapper for POST …/checkout/request failures.
 * Call sites only pass labels — never inline error→copy switches beside this.
 */
export type CheckoutRequestErrorLabels = {
  guestCountRequired: string;
  partyMergeRequired: string;
  emptySession: string;
  noActiveSession: string;
  tableNotAvailable: string;
  invalidNif: string;
  splitPlanLocked: string;
  /** Individual checkout (optional — only the guest bill page passes these). */
  individualClaimConflict?: string;
  individualNameTaken?: string;
  individualNothingClaimed?: string;
  /** Network / unknown — last resort only. */
  fallback: string;
};

const LOCKED_CODES = new Set([
  'split_mode_locked',
  'locked_allocation_changed',
  'split_shape_locked',
]);

export function messageForCheckoutRequestError(
  error: string | null | undefined,
  labels: CheckoutRequestErrorLabels,
): string {
  const code = (error ?? '').trim();
  if (!code || code === 'checkout_request_failed' || code === 'network_error') {
    return labels.fallback;
  }
  if (code === 'guest_count_required') return labels.guestCountRequired;
  if (code === 'party_merge_required') return labels.partyMergeRequired;
  if (code === 'empty_session') return labels.emptySession;
  if (code === 'no_active_session') return labels.noActiveSession;
  if (code === 'table_not_available') return labels.tableNotAvailable;
  if (code === 'invalid_nif') return labels.invalidNif;
  if (code === 'claim_conflict' && labels.individualClaimConflict) {
    return labels.individualClaimConflict;
  }
  if (code === 'name_taken' && labels.individualNameTaken) return labels.individualNameTaken;
  if (code === 'empty_ticket' && labels.individualNothingClaimed) {
    return labels.individualNothingClaimed;
  }
  if (LOCKED_CODES.has(code)) return labels.splitPlanLocked;
  return labels.fallback;
}
