/**
 * Sole registry of checkout-chain error codes: HTTP status + which phone/staff copy slot a code
 * uses. Server routes/libs get their status here, `messageForCheckoutRequestError` gets its copy
 * slot here — never a second code→status table or code→copy switch beside this.
 * Wire strings are unchanged (already-open pages still send/receive the same codes).
 *
 * Covers: checkout/request, ensure-entry, confirm-payment, resume-ordering, unlock(-ticket),
 * unlock-ticket, apply-discount, and the SQL RPC codes they pass through.
 */

export const CHECKOUT_ERROR_STATUS = {
  // 400 — malformed or incomplete request
  missing_slug: 400,
  invalid_json: 400,
  invalid_table_id: 400,
  missing_table_id: 400,
  missing_bill_split_id: 400,
  missing_ticket_keys: 400,
  invalid_split_mode: 400,
  invalid_split: 400,
  invalid_nif: 400,
  invalid_guest_client_id: 400,
  invalid_client_request_id: 400,
  missing_payment_method: 400,
  invalid_payment_method: 400,
  missing_payment_lines: 400,
  invalid_payment_lines: 400,
  payment_lines_amount_mismatch: 400,
  invalid_request: 400,
  invalid_ticket: 400,
  empty_ticket: 400,
  empty_split: 400,
  empty_session: 400,
  invalid_person_index: 400,
  invalid_collected_amount: 400,
  table_not_available: 400,
  guest_count_required: 400,
  party_merge_required: 400,
  unassigned_items: 400,
  incomplete_qty: 400,
  amount_mismatch: 400,
  reason_required: 400,
  invalid_reason: 400,
  reason_detail_required: 400,
  // 401 — no session
  unauthorized: 401,
  // 403 — not allowed
  staff_only: 403,
  staff_checkout_request_forbidden: 403,
  not_your_ticket: 403,
  // 404 — nothing to act on
  no_active_session: 404,
  no_session: 404,
  bill_split_not_found: 404,
  ticket_not_found: 404,
  // 409 — state conflict
  claim_conflict: 409,
  by_item_unit_mismatch: 409,
  by_item_cut_change_at_collect: 409,
  name_taken: 409,
  ticket_locked: 409,
  ticket_paid: 409,
  ticket_collecting: 409,
  locked_ticket_changed: 409,
  stale_plan: 409,
  split_mode_locked: 409,
  split_shape_locked: 409,
  locked_allocation_changed: 409,
  bill_split_cancelled: 409,
  already_paid: 409,
  client_request_id_conflict: 409,
  whole_table_paid: 409,
  discount_locked_after_payment: 409,
  // 500 — server fault
  session_lookup_failed: 500,
  party_lookup_failed: 500,
  upsert_failed: 500,
  invalid_existing_split: 500,
  fetch_failed: 500,
  bill_update_failed: 500,
  session_close_failed: 500,
  resume_failed: 500,
  individual_apply_failed: 500,
  // 503 — deployment
  server_misconfigured: 503,
} as const;

export type CheckoutErrorCode = keyof typeof CHECKOUT_ERROR_STATUS;

export function isCheckoutErrorCode(value: unknown): value is CheckoutErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CHECKOUT_ERROR_STATUS, value);
}

/** HTTP status for a code; an unregistered code is a server fault (500). */
export function checkoutErrorStatus(code: string): number {
  return isCheckoutErrorCode(code) ? CHECKOUT_ERROR_STATUS[code] : 500;
}

/** `{ ok:false }` result with the registered status — the sole way libs build a failure. */
export function checkoutFailure(
  code: CheckoutErrorCode,
  extra?: { message?: string },
): { ok: false; error: CheckoutErrorCode; status: number; message?: string } {
  return { ok: false, error: code, status: checkoutErrorStatus(code), ...extra };
}

/** Copy slots a code can use; the surface supplies the text for the slots it has. */
export type CheckoutErrorCopyKey =
  | 'guestCountRequired'
  | 'partyMergeRequired'
  | 'emptySession'
  | 'noActiveSession'
  | 'tableNotAvailable'
  | 'invalidNif'
  | 'splitPlanLocked'
  | 'individualClaimConflict'
  | 'individualUnitMismatch'
  | 'byItemCutChangeAtCollect'
  | 'individualNameTaken'
  | 'individualNothingClaimed'
  | 'individualCallRefused'
  | 'splitUnassignedItems'
  | 'splitIncompleteQty'
  | 'splitAmountMismatch';

export const CHECKOUT_ERROR_COPY: Partial<Record<CheckoutErrorCode, CheckoutErrorCopyKey>> = {
  guest_count_required: 'guestCountRequired',
  party_merge_required: 'partyMergeRequired',
  empty_session: 'emptySession',
  no_active_session: 'noActiveSession',
  table_not_available: 'tableNotAvailable',
  invalid_nif: 'invalidNif',
  claim_conflict: 'individualClaimConflict',
  by_item_unit_mismatch: 'individualUnitMismatch',
  by_item_cut_change_at_collect: 'byItemCutChangeAtCollect',
  name_taken: 'individualNameTaken',
  empty_ticket: 'individualNothingClaimed',
  stale_plan: 'individualCallRefused',
  ticket_locked: 'individualCallRefused',
  locked_ticket_changed: 'individualCallRefused',
  not_your_ticket: 'individualCallRefused',
  ticket_paid: 'individualCallRefused',
  ticket_collecting: 'individualCallRefused',
  unassigned_items: 'splitUnassignedItems',
  incomplete_qty: 'splitIncompleteQty',
  amount_mismatch: 'splitAmountMismatch',
  split_mode_locked: 'splitPlanLocked',
  locked_allocation_changed: 'splitPlanLocked',
  split_shape_locked: 'splitPlanLocked',
};
