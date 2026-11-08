/**
 * 409: the table's buffet changed between pricing and the locked write
 * (`append_order_items` / `switch_table_buffet`) — re-read, re-price, resubmit.
 */
export const BUFFET_CHANGED = 'buffet_changed' as const;

/** 409 when the table's buffet would change after it entered checkout. */
export const BUFFET_SWITCH_LOCKED = 'buffet_switch_locked' as const;

/**
 * Facts that decide「已进入结账」for one session (server loads them, floor UI receives them).
 * Pre-bill prints are not here: the system keeps no per-session pre-bill state.
 */
export type CheckoutEntrySignals = {
  /** `table_sessions.status = 'billing'` (whole-table checkout called). */
  sessionBilling: boolean;
  /** A `bill_splits` row in `requested` for the session (called / staff entered checkout). */
  checkoutRequested: boolean;
  /** Individual checkout: tickets in `bill_split_ticket_calls.state = 'called'`. */
  calledTicketCount: number;
  /** `session_collected_payments` rows (any collection booked). */
  collectedPaymentCount: number;
  /** `bill_sync_jobs` pending or succeeded for the session's bill splits (invoice issued / issuing). */
  invoiceJobCount: number;
};

/** Sole「是否进入结账」: called checkout, any collection, or any invoice → buffet switch locked. */
export function hasEnteredCheckout(signals: CheckoutEntrySignals): boolean {
  return (
    signals.sessionBilling
    || signals.checkoutRequested
    || signals.calledTicketCount > 0
    || signals.collectedPaymentCount > 0
    || signals.invoiceJobCount > 0
  );
}
