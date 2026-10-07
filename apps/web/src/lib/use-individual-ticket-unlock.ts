'use client';

import { messageForCheckoutErrorOverrides } from '@/lib/checkout-request-error-message';
import { useCallback, useRef, useState } from 'react';
import { requestStaffUnlockTickets } from '@/lib/request-individual-checkout';

type Messages = {
  success: string;
  failed: string;
  collecting: string;
};

/** Staff per-ticket unlock (replaces whole-table resume for individual-checkout plans). */
export function useIndividualTicketUnlock(params: {
  restaurantSlug: string;
  tableId: string;
  onMutated: (tableId: string) => void;
  showToast: (message: string, kind: 'error' | 'success') => void;
  messages: Messages;
}) {
  const { restaurantSlug, tableId, onMutated, showToast, messages } = params;
  const [unlockingKeys, setUnlockingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const inFlight = useRef(new Set<string>());

  const unlockTicket = useCallback(
    async (ticketKey: string) => {
      if (!ticketKey || inFlight.current.has(ticketKey)) return;
      inFlight.current.add(ticketKey);
      setUnlockingKeys(new Set(Array.from(inFlight.current)));
      try {
        const outcome = await requestStaffUnlockTickets({
          slug: restaurantSlug,
          tableId,
          ticketKeys: [ticketKey],
        });
        if (!outcome.ok) {
          showToast(
            messageForCheckoutErrorOverrides(
              outcome.error,
              { ticket_collecting: messages.collecting, ticket_paid: messages.collecting },
              messages.failed,
            ),
            'error',
          );
          return;
        }
        onMutated(tableId);
        showToast(messages.success, 'success');
      } finally {
        inFlight.current.delete(ticketKey);
        setUnlockingKeys(new Set(Array.from(inFlight.current)));
      }
    },
    [messages.collecting, messages.failed, messages.success, onMutated, restaurantSlug, showToast, tableId],
  );

  return { unlockingKeys, unlockTicket };
}
