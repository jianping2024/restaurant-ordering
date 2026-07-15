'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { BillSplitDraftInput } from '@/lib/bill-split-draft';
import { deriveBillView, isBillOrdersComplete } from '@/lib/customer-bill-sync';
import { dashboardCheckoutFocusHref } from '@/lib/checkout-queue-focus';
import {
  BILL_SYNC_FRESH_MS,
  buildOptimisticRequestedBillSplit,
  buildSubmitPersons,
  CHECKOUT_REDIRECT_TIMEOUT_MS,
  DASHBOARD_CHECKOUT_PATH_PREFIX,
  shouldSkipPreSubmitOrderSync,
  validateSubmitSplitDraft,
} from '@/lib/checkout-request-submit';
import { stageCheckoutRequestForQueue } from '@/lib/checkout-request-staging';
import { requestCheckoutRequest } from '@/lib/request-checkout-request';
import { normalizePortugueseNif } from '@/lib/pt-nif';
import type { SplitMode, SplitPerson, SplitResult } from '@/types';
import type { Order } from '@/types';

export type CheckoutRequestSubmitPhase = 'idle' | 'submitting' | 'redirecting';

type SplitDraftSlice = {
  splitMode: SplitMode | null;
  splitValidation: { ok: boolean };
  splitDraftInput: BillSplitDraftInput;
  splitPeople: ReadonlyArray<{ name: string }>;
  buildPersonsForSubmit: () => SplitPerson[];
  resolveSplitDraftInputForSubmit?: () => BillSplitDraftInput;
};

type Messages = {
  billSyncFailed: string;
  billIncomplete: string;
  splitUnassignedItems: string;
  splitIncompleteQty: string;
  splitAmountMismatch: string;
  nifInvalid: string;
  splitPlanLocked: string;
  actionFailed: string;
  redirectTimeout?: string;
};

type Params = {
  restaurant: { id: string; slug: string };
  tableId: string;
  displayName: string;
  sessionId: string | null;
  orders: Order[];
  lastSyncedAt: number | null;
  refreshOrders: () => Promise<Order[] | null>;
  commitOrders: (next: Order[]) => void;
  splitDraft: SplitDraftSlice;
  customerNifInput: string;
  checkoutRedirectHref: string | null;
  onSubmitSuccess: (result: SplitResult[]) => void;
  onCustomerSubmitSuccess: () => void;
  onBusyChange?: (busy: boolean) => void;
  showToast: (message: string, kind: 'error' | 'success') => void;
  messages: Messages;
};

function splitValidationToast(
  issue: 'unassigned_items' | 'incomplete_qty' | 'amount_mismatch',
  messages: Messages,
): string {
  if (issue === 'unassigned_items') return messages.splitUnassignedItems;
  if (issue === 'incomplete_qty') return messages.splitIncompleteQty;
  return messages.splitAmountMismatch;
}

export function useCheckoutRequestSubmit(params: Params) {
  const {
    restaurant,
    tableId,
    displayName,
    sessionId,
    orders,
    lastSyncedAt,
    refreshOrders,
    commitOrders,
    splitDraft,
    customerNifInput,
    checkoutRedirectHref,
    onSubmitSuccess,
    onCustomerSubmitSuccess,
    onBusyChange,
    showToast,
    messages,
  } = params;

  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<CheckoutRequestSubmitPhase>('idle');
  const phaseRef = useRef<CheckoutRequestSubmitPhase>('idle');
  const inFlightRef = useRef(false);
  const redirectStartedAtRef = useRef<number | null>(null);

  const setPhaseSafe = useCallback((next: CheckoutRequestSubmitPhase) => {
    phaseRef.current = next;
    setPhase(next);
    onBusyChange?.(next !== 'idle');
  }, [onBusyChange]);

  const resolveFreshOrders = useCallback(async (): Promise<Order[] | null> => {
    if (shouldSkipPreSubmitOrderSync(lastSyncedAt)) {
      return orders;
    }
    const displayedBefore = orders;
    const fresh = await refreshOrders();
    if (!fresh) {
      showToast(messages.billSyncFailed, 'error');
      return null;
    }
    if (!isBillOrdersComplete(displayedBefore, fresh)) {
      commitOrders(fresh);
      showToast(messages.billIncomplete, 'error');
      return null;
    }
    commitOrders(fresh);
    return fresh;
  }, [
    commitOrders,
    lastSyncedAt,
    messages.billIncomplete,
    messages.billSyncFailed,
    orders,
    refreshOrders,
    showToast,
  ]);

  const submitCallBill = useCallback(async () => {
    if (inFlightRef.current || phaseRef.current !== 'idle') return;
    if (splitDraft.splitMode && !splitDraft.splitValidation.ok) return;

    inFlightRef.current = true;
    setPhaseSafe('submitting');
    let keepBusyAfterSubmit = false;
    try {
      const freshOrders = await resolveFreshOrders();
      if (!freshOrders) return;

      const validated = validateSubmitSplitDraft(
        splitDraft.resolveSplitDraftInputForSubmit?.() ?? splitDraft.splitDraftInput,
        freshOrders,
      );
      if (!validated.ok) {
        showToast(splitValidationToast(validated.issue, messages), 'error');
        return;
      }

      const persons = buildSubmitPersons({
        splitMode: splitDraft.splitMode,
        submitResults: validated.submitResults,
        splitPeople: splitDraft.splitPeople,
        buildPersonsForSubmit: splitDraft.buildPersonsForSubmit,
      });

      const requestResult = await requestCheckoutRequest({
        slug: restaurant.slug,
        tableId,
        splitMode: splitDraft.splitMode,
        persons,
        result: validated.submitResults,
        customerNif: normalizePortugueseNif(customerNifInput) || null,
      });

      if (!requestResult.ok) {
        const message =
          requestResult.error === 'invalid_nif'
            ? messages.nifInvalid
            : requestResult.error === 'split_mode_locked'
              || requestResult.error === 'locked_allocation_changed'
              || requestResult.error === 'split_shape_locked'
              ? messages.splitPlanLocked
              : messages.actionFailed;
        showToast(message, 'error');
        return;
      }

      onSubmitSuccess(requestResult.result);

      if (sessionId) {
        const optimistic = buildOptimisticRequestedBillSplit({
          restaurantId: restaurant.id,
          sessionId,
          tableId,
          displayName,
          billSplitId: requestResult.bill_split_id,
          splitMode: splitDraft.splitMode ?? 'custom',
          persons,
          result: requestResult.result,
          totalAmount: deriveBillView(freshOrders).total,
          customerNif: normalizePortugueseNif(customerNifInput) || null,
          orderIds: freshOrders.map((order) => order.id),
        });
        stageCheckoutRequestForQueue(optimistic);
      }

      if (checkoutRedirectHref) {
        redirectStartedAtRef.current = Date.now();
        keepBusyAfterSubmit = true;
        setPhaseSafe('redirecting');
        router.replace(
          dashboardCheckoutFocusHref({
            tableId,
            requestId: requestResult.bill_split_id,
          }),
        );
        return;
      }

      onCustomerSubmitSuccess();
    } catch {
      showToast(messages.actionFailed, 'error');
    } finally {
      if (!keepBusyAfterSubmit) {
        setPhaseSafe('idle');
        inFlightRef.current = false;
      }
    }
  }, [
    checkoutRedirectHref,
    customerNifInput,
    displayName,
    messages,
    onCustomerSubmitSuccess,
    onSubmitSuccess,
    resolveFreshOrders,
    restaurant.id,
    restaurant.slug,
    router,
    sessionId,
    setPhaseSafe,
    showToast,
    splitDraft,
    tableId,
  ]);

  useEffect(() => {
    if (phase !== 'redirecting') return;
    if (!pathname.startsWith(DASHBOARD_CHECKOUT_PATH_PREFIX)) return;
    redirectStartedAtRef.current = null;
    setPhaseSafe('idle');
    inFlightRef.current = false;
  }, [pathname, phase, setPhaseSafe]);

  useEffect(() => {
    if (phase !== 'redirecting') return;
    const timer = window.setTimeout(() => {
      if (phaseRef.current !== 'redirecting') return;
      showToast(messages.redirectTimeout ?? messages.actionFailed, 'error');
      redirectStartedAtRef.current = null;
      setPhaseSafe('idle');
      inFlightRef.current = false;
    }, CHECKOUT_REDIRECT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [messages.actionFailed, messages.redirectTimeout, phase, setPhaseSafe, showToast]);

  const isCallBillBusy = phase !== 'idle';

  return {
    phase,
    isCallBillBusy,
    submitCallBill,
    billSyncFreshMs: BILL_SYNC_FRESH_MS,
  };
}
