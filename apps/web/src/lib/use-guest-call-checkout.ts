'use client';

/**
 * Sole guest-phone「呼叫结账」: refresh the bill, gate on guest count / party merge, then send this
 * phone's single ticket. The server merges it into the shared plan and locks it; the read model is
 * reloaded from the server afterwards (never commit a local split — the plan holds other tickets).
 */
import { useCallback, useRef, useState } from 'react';
import { isBillOrdersComplete } from '@/lib/customer-bill-sync';
import { shouldSkipPreSubmitOrderSync } from '@/lib/checkout-request-submit';
import { messageForCheckoutRequestError } from '@/lib/checkout-request-error-message';
import type { MyTicket } from '@/lib/guest-claim';
import { requestCheckoutRequest } from '@/lib/request-checkout-request';
import { isBillGuestCountConfirmed } from '@/lib/table-guest-count';
import { isPartyMemberCountAllowedForCheckout } from '@/lib/table-party-groups';
import type { BillOrdersRefresh } from '@/lib/use-customer-bill-read-model';
import type { Order } from '@/types';

type Messages = {
  billSyncFailed: string;
  billIncomplete: string;
  splitPlanLocked: string;
  actionFailed: string;
  guestCountRequired: string;
  partyMergeRequired: string;
  individualNothingClaimed: string;
  individualClaimConflict: string;
  individualNameTaken: string;
};

type Params = {
  restaurant: { slug: string };
  tableId: string;
  orders: Order[];
  partyMemberCount: number;
  lastSyncedAt: number | null;
  refreshOrders: () => Promise<BillOrdersRefresh | null>;
  commitOrders: (next: Order[]) => void;
  guestClientId: string | null;
  /** Latest ticket of this phone; read at submit time. */
  getTicket: () => MyTicket;
  /** The server accepted the call. */
  onCalled: () => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  showToast: (message: string, kind: 'error' | 'success') => void;
  messages: Messages;
};

export function useGuestCallCheckout(params: Params) {
  const {
    restaurant,
    tableId,
    orders,
    partyMemberCount,
    lastSyncedAt,
    refreshOrders,
    commitOrders,
    guestClientId,
    getTicket,
    onCalled,
    onBusyChange,
    showToast,
    messages,
  } = params;

  const [busy, setBusy] = useState(false);
  const inFlightRef = useRef(false);

  const setBusySafe = useCallback(
    (next: boolean) => {
      setBusy(next);
      onBusyChange?.(next);
    },
    [onBusyChange],
  );

  const resolveFreshBill = useCallback(async (): Promise<BillOrdersRefresh | null> => {
    if (shouldSkipPreSubmitOrderSync(lastSyncedAt)) {
      return { orders, partyMemberCount };
    }
    const displayedBefore = orders;
    const fresh = await refreshOrders();
    if (!fresh) {
      showToast(messages.billSyncFailed, 'error');
      return null;
    }
    commitOrders(fresh.orders);
    if (!isBillOrdersComplete(displayedBefore, fresh.orders)) {
      showToast(messages.billIncomplete, 'error');
      return null;
    }
    return fresh;
  }, [
    commitOrders,
    lastSyncedAt,
    messages.billIncomplete,
    messages.billSyncFailed,
    orders,
    partyMemberCount,
    refreshOrders,
    showToast,
  ]);

  const submitCall = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusySafe(true);
    try {
      const fresh = await resolveFreshBill();
      if (!fresh) return;
      if (!isBillGuestCountConfirmed(fresh.orders)) {
        showToast(messages.guestCountRequired, 'error');
        return;
      }
      if (!isPartyMemberCountAllowedForCheckout(fresh.partyMemberCount)) {
        showToast(messages.partyMergeRequired, 'error');
        return;
      }
      if (!guestClientId) {
        showToast(messages.actionFailed, 'error');
        return;
      }
      const ticket = getTicket();
      if (!ticket.hasClaim) {
        showToast(messages.individualNothingClaimed, 'error');
        return;
      }

      const outcome = await requestCheckoutRequest({
        slug: restaurant.slug,
        tableId,
        splitMode: 'by_item',
        persons: ticket.persons,
        result: ticket.result,
        guestClientId,
      });
      if (!outcome.ok) {
        // The plan moved under us (claim / name conflict, stale plan): reload the truth so the
        // others' tickets and the over-claimed dishes show up.
        void refreshOrders();
        showToast(
          messageForCheckoutRequestError(outcome.error, {
            guestCountRequired: messages.guestCountRequired,
            partyMergeRequired: messages.partyMergeRequired,
            emptySession: messages.actionFailed,
            noActiveSession: messages.actionFailed,
            tableNotAvailable: messages.actionFailed,
            splitPlanLocked: messages.splitPlanLocked,
            individualClaimConflict: messages.individualClaimConflict,
            individualNameTaken: messages.individualNameTaken,
            individualNothingClaimed: messages.individualNothingClaimed,
            fallback: messages.actionFailed,
          }),
          'error',
        );
        return;
      }
      await onCalled();
    } catch {
      showToast(messages.actionFailed, 'error');
    } finally {
      setBusySafe(false);
      inFlightRef.current = false;
    }
  }, [
    getTicket,
    guestClientId,
    messages,
    onCalled,
    refreshOrders,
    resolveFreshBill,
    restaurant.slug,
    setBusySafe,
    showToast,
    tableId,
  ]);

  return { isCallBillBusy: busy, submitCall };
}
