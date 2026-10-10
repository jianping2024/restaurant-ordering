import { allocationLockedTicketKeys } from '@/lib/checkout-split-continuation';
import {
  isByItemPerTicketCheckoutPlan,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import type { BillSplit } from '@/types';

/**
 * Staff by-item share-panel control to delete one unpaid called ticket (dishes return to the pool)
 * (sole shape — workbench takes this one prop).
 * Visible copy: sole `checkout.resumeOrdering` / `resumeOrderingOperating`
 * (same words as session resume — do not invent a second label).
 */
export type StaffTicketUnlock = {
  unlockableKeys: ReadonlySet<string>;
  unlockingKeys: ReadonlySet<string>;
  onUnlock: (ticketKey: string) => void;
  label: string;
  busyLabel: string;
};

/** Called tickets with no payment yet — the only ones staff (or the guest) may unlock (delete). */
export function unlockableIndividualTicketKeys(
  split: Pick<BillSplit, 'split_mode' | 'individual_tickets' | 'result' | 'persons'>,
  collectedPayments: SessionCollectedPayment[],
): ReadonlySet<string> {
  if (!isByItemPerTicketCheckoutPlan(split) || !split.individual_tickets) {
    return new Set();
  }
  const collected = allocationLockedTicketKeys(
    split as BillSplit,
    collectedPayments,
  );
  return new Set(
    split.individual_tickets
      .filter((ticket) => ticket.state === 'called' && !collected.has(ticket.ticket_key))
      .map((ticket) => ticket.ticket_key),
  );
}
