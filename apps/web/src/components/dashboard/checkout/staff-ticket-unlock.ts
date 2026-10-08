import { allocationLockedTicketKeys } from '@/lib/checkout-split-continuation';
import {
  isByItemPerTicketCheckoutPlan,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import type { BillSplit } from '@/types';

/**
 * Staff「解锁」control for an individual-checkout plan (sole shape — the settle list and the
 * by-item workbench both take this one prop).
 */
export type StaffTicketUnlock = {
  unlockableKeys: ReadonlySet<string>;
  unlockingKeys: ReadonlySet<string>;
  onUnlock: (ticketKey: string) => void;
  label: string;
  busyLabel: string;
};

/** Called tickets with no payment yet — the only ones staff (or the guest) may send back to draft. */
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
