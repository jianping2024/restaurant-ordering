'use client';

/**
 * Sole guest-phone「呼叫结账」for whole_table | even | by_item.
 * by_item → one ticket (submitIndividualCall). whole/even → shared table plan.
 */
import { useCallback, useRef, useState } from 'react';
import { buildWholeTableCheckoutPayload } from '@/lib/checkout-split-intent';
import { isBillOrdersComplete } from '@/lib/customer-bill-sync';
import { shouldSkipPreSubmitOrderSync } from '@/lib/checkout-request-submit';
import { messageForCheckoutRequestError } from '@/lib/checkout-request-error-message';
import type { GuestBillSplitMode } from '@/lib/guest-bill-split-mode';
import type { MyTicket } from '@/lib/guest-claim';
import { requestCheckoutRequest } from '@/lib/request-checkout-request';
import { isPartyMemberCountAllowedForCheckout } from '@/lib/table-party-groups';
import type { BillOrdersRefresh } from '@/lib/use-customer-bill-read-model';
import type { Order, SplitPerson, SplitResult } from '@/types';

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
  individualCallRefused: string;
  splitUnassignedItems?: string;
  splitIncompleteQty?: string;
  splitAmountMismatch?: string;
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
  mode: GuestBillSplitMode;
  /** Latest by-item ticket; read at submit time. */
  getTicket: () => MyTicket;
  /** Even roster payload; read at submit time. */
  getEvenPayload: () => { persons: SplitPerson[]; result: SplitResult[] } | null;
  total: number;
  /** by_item ticket accepted. */
  onByItemCalled: () => Promise<void>;
  /** whole_table / even plan accepted. */
  onTablePlanCalled: () => Promise<void>;
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
    mode,
    getTicket,
    getEvenPayload,
    total,
    onByItemCalled,
    onTablePlanCalled,
    onBusyChange,
    showToast,
    messages,
  } = params;

  const [busy, setBusy] = useState(false);
  const inFlightRef = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

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
      if (!isPartyMemberCountAllowedForCheckout(fresh.partyMemberCount)) {
        showToast(messages.partyMergeRequired, 'error');
        return;
      }
      if (!guestClientId) {
        showToast(messages.actionFailed, 'error');
        return;
      }

      const activeMode = modeRef.current;

      if (activeMode === 'by_item') {
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
          void refreshOrders();
          showToast(
            messageForCheckoutRequestError(outcome.error, {
              guestCountRequired: messages.guestCountRequired,
              partyMergeRequired: messages.partyMergeRequired,
              emptySession: messages.actionFailed,
              noActiveSession: messages.actionFailed,
              tableNotAvailable: messages.actionFailed,
              splitPlanLocked: messages.splitPlanLocked,
              splitUnassignedItems: messages.splitUnassignedItems,
              splitIncompleteQty: messages.splitIncompleteQty,
              splitAmountMismatch: messages.splitAmountMismatch,

              individualClaimConflict: messages.individualClaimConflict,
              individualNameTaken: messages.individualNameTaken,
              individualNothingClaimed: messages.individualNothingClaimed,
              individualCallRefused: messages.individualCallRefused,
              fallback: messages.actionFailed,
            }),
            'error',
          );
          return;
        }
        await onByItemCalled();
        return;
      }

      if (activeMode === 'whole_table') {
        const payload = buildWholeTableCheckoutPayload(total);
        const outcome = await requestCheckoutRequest({
          slug: restaurant.slug,
          tableId,
          splitMode: 'whole_table',
          persons: payload.persons,
          result: payload.result,
          guestClientId,
        });
        if (!outcome.ok) {
          void refreshOrders();
          showToast(
            messageForCheckoutRequestError(outcome.error, {
              guestCountRequired: messages.guestCountRequired,
              partyMergeRequired: messages.partyMergeRequired,
              emptySession: messages.actionFailed,
              noActiveSession: messages.actionFailed,
              tableNotAvailable: messages.actionFailed,
              splitPlanLocked: messages.splitPlanLocked,
              splitUnassignedItems: messages.splitUnassignedItems,
              splitIncompleteQty: messages.splitIncompleteQty,
              splitAmountMismatch: messages.splitAmountMismatch,

              fallback: messages.actionFailed,
            }),
            'error',
          );
          return;
        }
        await onTablePlanCalled();
        return;
      }

      // even (1+ people)
      const even = getEvenPayload();
      if (!even || even.result.length < 1) {
        showToast(messages.splitAmountMismatch ?? messages.actionFailed, 'error');
        return;
      }
      const outcome = await requestCheckoutRequest({
        slug: restaurant.slug,
        tableId,
        splitMode: 'even',
        persons: even.persons,
        result: even.result,
        guestClientId,
      });
      if (!outcome.ok) {
        void refreshOrders();
        showToast(
          messageForCheckoutRequestError(outcome.error, {
            guestCountRequired: messages.guestCountRequired,
            partyMergeRequired: messages.partyMergeRequired,
            emptySession: messages.actionFailed,
            noActiveSession: messages.actionFailed,
            tableNotAvailable: messages.actionFailed,
            splitPlanLocked: messages.splitPlanLocked,
            splitUnassignedItems: messages.splitUnassignedItems,
            splitIncompleteQty: messages.splitIncompleteQty,
            splitAmountMismatch: messages.splitAmountMismatch,

            fallback: messages.actionFailed,
          }),
          'error',
        );
        return;
      }
      await onTablePlanCalled();
    } catch {
      showToast(messages.actionFailed, 'error');
    } finally {
      setBusySafe(false);
      inFlightRef.current = false;
    }
  }, [
    getEvenPayload,
    getTicket,
    guestClientId,
    messages,
    onByItemCalled,
    onTablePlanCalled,
    refreshOrders,
    resolveFreshBill,
    restaurant.slug,
    setBusySafe,
    showToast,
    tableId,
    total,
  ]);

  return { isCallBillBusy: busy, submitCall };
}
