/**
 * Guest bill split mode chips: whole_table | even | by_item (no custom).
 * Lock when the shared plan already has a non-draft mode or any collection.
 * Mode order/labels sole source: {@link GUEST_SPLIT_MODE_ORDER}.
 */
import { isWholeTableSplit } from './checkout-split-intent';
import {
  GUEST_SPLIT_MODE_ORDER,
  type GuestSplitModeId,
} from './i18n/guest-split-mode-messages';
import type { BillSplit } from '../types';

export type GuestBillSplitMode = GuestSplitModeId;
export const GUEST_BILL_SPLIT_MODES = GUEST_SPLIT_MODE_ORDER;

export function isGuestBillSplitMode(value: unknown): value is GuestBillSplitMode {
  return (
    typeof value === 'string' &&
    (GUEST_BILL_SPLIT_MODES as readonly string[]).includes(value)
  );
}

/** Map persisted bill_splits.split_mode onto the guest chip set. */
export function guestBillSplitModeFromSplit(split: BillSplit | null): GuestBillSplitMode | null {
  if (!split) return null;
  if (split.split_mode === 'even') return 'even';
  if (split.split_mode === 'by_item') return 'by_item';
  if (isWholeTableSplit(split) || split.split_mode === 'whole_table') return 'whole_table';
  return null;
}

/**
 * Mode chips lock once money moved or a shared plan is already on the wire
 * (by-item tickets / even / whole_table requested|confirmed).
 */
export function guestBillSplitModeLocked(
  split: BillSplit | null,
  collectedPaymentCount: number,
): boolean {
  if (collectedPaymentCount > 0) return true;
  if (!split) return false;
  if (split.split_mode === 'by_item' && (split.persons?.length ?? 0) > 0) return true;
  if (split.split_mode === 'even' && (split.result?.length ?? 0) > 0) return true;
  if (
    (isWholeTableSplit(split) || split.split_mode === 'whole_table') &&
    (split.status === 'requested' || split.status === 'confirmed')
  ) {
    return true;
  }
  return split.status === 'requested' || split.status === 'confirmed';
}

/** Default chip: whole_table; hydrate from server when a plan already exists. */
export function resolveGuestBillSplitMode(params: {
  draft: GuestBillSplitMode;
  existingSplit: BillSplit | null;
  collectedPaymentCount: number;
}): { mode: GuestBillSplitMode; locked: boolean } {
  const locked = guestBillSplitModeLocked(
    params.existingSplit,
    params.collectedPaymentCount,
  );
  const fromServer = guestBillSplitModeFromSplit(params.existingSplit);
  if (locked && fromServer) return { mode: fromServer, locked: true };
  return { mode: params.draft, locked };
}

/** Whole-table / even plan already called — every phone shows the submitted screen. */
export function guestTablePlanHoldsCheckout(split: BillSplit | null): boolean {
  if (!split) return false;
  if (split.split_mode === 'by_item') return false;
  return split.status === 'requested' || split.status === 'confirmed';
}
