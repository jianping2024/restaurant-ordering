/**
 * Sole toast mapper for checkout-chain failures (code → copy slot lives in `checkout-error-codes`).
 * Call sites pass labels (and per-surface `overrides`) — never inline error→copy compares.
 */
import {
  CHECKOUT_ERROR_COPY,
  isCheckoutErrorCode,
  type CheckoutErrorCode,
} from '@/lib/checkout-error-codes';

export type CheckoutRequestErrorLabels = {
  guestCountRequired: string;
  partyMergeRequired: string;
  emptySession: string;
  noActiveSession: string;
  tableNotAvailable: string;
  /** Staff NIF paths only; the guest phone never sends a NIF. */
  invalidNif?: string;
  splitPlanLocked: string;
  /** Individual checkout (optional — only the guest bill page passes these). */
  individualClaimConflict?: string;
  /** Carries `{dish}` — filled from the first rejected line via `context.dish`. */
  individualUnitMismatch?: string;
  /** Staff only; carries `{dish}`. */
  byItemCutChangeAtCollect?: string;
  individualNameTaken?: string;
  individualNothingClaimed?: string;
  /** Ticket already locked / paid / owned by another phone, or the plan changed under it. */
  individualCallRefused?: string;
  /** Split validation (guest whole/even/by-item plan rejected by the server). */
  splitUnassignedItems?: string;
  splitIncompleteQty?: string;
  splitAmountMismatch?: string;
  /** Network / unknown — last resort only. */
  fallback: string;
};

export function messageForCheckoutRequestError(
  error: string | null | undefined,
  labels: CheckoutRequestErrorLabels,
  /** A surface that words one code differently (e.g. resume: ticket_collecting). */
  overrides?: Partial<Record<CheckoutErrorCode, string>>,
  /** Values for `{placeholders}` in the copy (e.g. the rejected dish name). */
  context?: { dish?: string },
): string {
  const code = (error ?? '').trim();
  if (!isCheckoutErrorCode(code)) return labels.fallback;
  const override = overrides?.[code];
  const slot = CHECKOUT_ERROR_COPY[code];
  const text = override || (slot && labels[slot]) || labels.fallback;
  return context?.dish ? text.replace('{dish}', context.dish) : text;
}

/** Surfaces with their own wording per code (no shared copy slot): typed codes, one fallback. */
export function messageForCheckoutErrorOverrides(
  error: string | null | undefined,
  overrides: Partial<Record<CheckoutErrorCode, string>>,
  fallback: string,
): string {
  const code = (error ?? '').trim();
  return (isCheckoutErrorCode(code) && overrides[code]) || fallback;
}
