'use client';

import {
  unlockableIndividualTicketKeys,
  type StaffTicketUnlock,
} from '@/components/dashboard/checkout/staff-ticket-unlock';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { BillSplit, Order, SplitPerson, SplitResult } from '@/types';
import { showToast } from '@/components/ui/Toast';
import { ReasonConfirmDialog } from '@/components/ui/ReasonConfirmDialog';
import {
  checkoutPersonKey,
  isCheckoutDetailLocked,
} from '@/lib/checkout-request-state';
import {
  collectPaymentInitialCustomerName,
  shouldAutoIssueFiscalAfterCollect,
} from '@/lib/checkout-print-ask';
import { splitPartyKey } from '@/lib/split-party-id';
import {
  hasConfirmedPerson,
  isByItemPerTicketCheckoutPlan,
  resumeOrderingConfirmVariant,
} from '@/lib/checkout-session-payments';
import { prepareStaffCheckoutResumeOrdering } from '@/lib/checkout-resume-ordering-gate';
import { logCheckoutResumeFailure } from '@/lib/checkout-resume-failure-log';
import {
  messageForCheckoutErrorOverrides,
  messageForCheckoutRequestError,
} from '@/lib/checkout-request-error-message';
import { requestCheckoutRequest } from '@/lib/request-checkout-request';
import { useCheckoutResumeOrdering } from '@/lib/use-checkout-resume-ordering';
import { useIndividualTicketUnlock } from '@/lib/use-individual-ticket-unlock';
import { mayFiscalBillQueue } from '@/lib/bill-sync-permission';
import { useStaffPrintFiscalInvoice } from '@/lib/use-staff-print-fiscal-invoice';
import { CheckoutHeadcountAdjustModal } from '@/components/dashboard/checkout/CheckoutHeadcountAdjustModal';
import { CollectPaymentModal, type CollectPaymentConfirmInput } from '@/components/dashboard/checkout/CollectPaymentModal';
import type { BillSyncPaymentMethod } from '@/lib/bill-sync-payload';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { abnormalReasonOptions } from '@/lib/audit/reason-labels';
import type { BuffetGuestSnapshot } from '@/lib/buffet-order';
import { useCheckoutBillDiscount } from '@/lib/checkout-discount/use-checkout-bill-discount';
import { shouldPromptCheckoutZeroHeadcount } from '@/lib/checkout-zero-headcount-prompt';
import { requestCheckoutApplyDiscount } from '@/lib/request-checkout-apply-discount';
import { requestCheckoutConfirmPayment } from '@/lib/request-checkout-confirm-payment';
import { collectAttemptFingerprint, createCollectAttemptIds } from '@/lib/collect-attempt-ids';
import { writePendingCheckoutPrintAsk } from '@/lib/checkout-print-ask-store';
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { menuItemImageUrlLookupFromRows } from '@/lib/menu-image';
import { sumBillableSessionTotal } from '@/lib/billable-session-lines';
import { buildCheckoutSettlementSummary } from '@/lib/checkout-settlement';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { useWaiterBoardOptional } from '@/components/dashboard/WaiterBoardProvider';
import type { Capabilities } from '@/lib/permissions/can';
import { StaffCheckoutSplitEditor } from '@/components/dashboard/checkout/StaffCheckoutSplitEditor';
import { fetchWaiterTablePageModelClient } from '@/lib/staff-board-client';
import { isBillGuestCountConfirmed } from '@/lib/table-guest-count';
import { toastWaiterBuffetOpenFailure } from '@/lib/waiter-buffet-open-failure-toast';
import {
  buffetWaiterOpenIntentFromSession,
  postWaiterBuffetOpenAndCommit,
} from '@/lib/waiter-buffet-open-submit';
import { activeBuffetsFromModel } from '@/lib/waiter-board-open-table';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import { waiterTableHref } from '@/lib/staff-routes';
import {
  buildWholeTableCheckoutPayload,
  isWholeTableSplit,
} from '@/lib/checkout-split-intent';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
type Props = {
  request: BillSplit;
  restaurantId: string;
  restaurantSlug: string;
  capabilities: Capabilities;
  billSyncToFiscal?: boolean;
  showBackButton?: boolean;
  onBack: () => void;
  /** Sticky shell for SettlementBar — default under staff top bar; board sheet overrides. */
  stickyShellClass?: string;
};

export function CheckoutRequestDetailHost({
  request,
  restaurantId,
  restaurantSlug,
  capabilities,
  billSyncToFiscal = false,
  showBackButton = true,
  onBack,
  stickyShellClass,
}: Props) {
  const canPrintFiscalInvoice =
    billSyncToFiscal && mayFiscalBillQueue(capabilities);
  const [collectAttempts] = useState(() => createCollectAttemptIds());
  const [collectPending, setCollectPending] = useState<{
    rowIndex: number;
    amount: number;
    wholeTable: boolean;
    personName?: string;
    partyId?: string;
    /** Ticket pre-discount obligation for collect modal discount line. */
    preDiscountAmount?: number;
  } | null>(null);
  const router = useRouter();
  const exitToTableDetail = useCallback(() => {
    router.push(waiterTableHref(restaurantSlug, request.table_id));
  }, [restaurantSlug, request.table_id, router]);
  const {
    reload,
    getCollectedForSession,
    applyConfirmPaymentOutcome,
    updateRequests,
    upsertRequestFromSubmit,
    setPrintAsk,
  } = useCheckoutRequests();
  const persistBeforePay = useRef<
    (() => Promise<{ persons: SplitPerson[]; result: SplitResult[] } | null>) | null
  >(null);
  const persistCollectTicket = useRef<
    | ((args: {
        personName: string;
        partyId?: string;
        modalAmount: number;
      }) => Promise<{ personIndex: number } | null>)
    | null
  >(null);
  const persistedBillSplitId = useRef<string | null>(null);
  const waiterBoard = useWaiterBoardOptional();
  const syncBoardAfterMutation = useCallback(
    (tableId: string) => {
      void waiterBoard?.refreshBoardAfterStaffMutation([tableId]);
    },
    [waiterBoard],
  );
  const onResumeMutated = useCallback(
    (tableId: string) => {
      void reload();
      syncBoardAfterMutation(tableId);
    },
    [reload, syncBoardAfterMutation],
  );
  const [processingKeys, setProcessingKeys] = useState<Set<string>>(() => new Set());
  const billDiscount = useCheckoutBillDiscount();
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const billT = getMessages(lang).bill;
  const beforeResume = useCallback(async () => {
    const prepared = await prepareStaffCheckoutResumeOrdering({
      request,
      collectedPayments: getCollectedForSession(request.session_id),
      flushDraft: persistBeforePay.current,
      persistPrunedByItem: async ({ persons, result }) => {
        const outcome = await requestCheckoutRequest({
          slug: restaurantSlug,
          tableId: request.table_id,
          splitMode: 'by_item',
          persons,
          result,
          allowPartialByItem: true,
        });
        if (!outcome.ok) {
          showToast(
            messageForCheckoutRequestError(outcome.error, {
              guestCountRequired: t.callCheckoutGuestCountRequired,
              partyMergeRequired: t.callCheckoutPartyMergeRequired,
              emptySession: t.callCheckoutEmptySession,
              noActiveSession: t.callCheckoutNoActiveSession,
              tableNotAvailable: t.callCheckoutTableNotAvailable,
              invalidNif: billT.nifInvalid,
              splitPlanLocked: billT.splitPlanLocked,
              fallback: t.callCheckoutFailed,
            }),
            'error',
          );
          return null;
        }
        const next: BillSplit = {
          ...request,
          id: outcome.bill_split_id,
          split_mode: 'by_item',
          persons,
          result: outcome.result,
          status: 'requested',
        };
        persistedBillSplitId.current = next.id;
        upsertRequestFromSubmit(next);
        return { persons, result: outcome.result };
      },
    });
    if (!prepared.ok) {
      logCheckoutResumeFailure({
        stage: 'prepare',
        error: prepared.code,
        slug: restaurantSlug,
        table_id: request.table_id,
        session_id: request.session_id ?? undefined,
      });
      if (prepared.code === 'default_guest_names') {
        showToast(t.resumeOrderingNeedRealNames, 'error');
      }
      return false;
    }
    return true;
  }, [
    billT.nifInvalid,
    billT.splitPlanLocked,
    getCollectedForSession,
    request,
    restaurantSlug,
    t,
    upsertRequestFromSubmit,
  ]);
  const {
    isResumeBusy,
    isResumeMutating,
    resumeOrdering,
  } = useCheckoutResumeOrdering({
    restaurantSlug,
    tableId: request.table_id,
    onMutated: onResumeMutated,
    beforeResume,
    showToast,
    messages: {
      failed: t.resumeOrderingFailed,
      blockedWholeTable: t.resumeOrderingBlockedWholeTable,
      success: t.resumeOrderingSuccess,
    },
  });
  const { unlockingKeys, unlockTicket } = useIndividualTicketUnlock({
    restaurantSlug,
    tableId: request.table_id,
    onMutated: onResumeMutated,
    showToast,
    messages: {
      success: t.resumeOrderingSuccess,
      failed: t.resumeOrderingFailed,
      collecting: t.resumeOrderingBlockedTicketPaid,
    },
  });
  const isByItemPerTicket = isByItemPerTicketCheckoutPlan(request);
  const ticketUnlock = useMemo<StaffTicketUnlock | undefined>(
    () =>
      isByItemPerTicket
        ? {
            unlockableKeys: unlockableIndividualTicketKeys(
              request,
              getCollectedForSession(request.session_id),
            ),
            unlockingKeys,
            onUnlock: (ticketKey) => void unlockTicket(ticketKey),
            label: t.resumeOrdering,
            busyLabel: t.resumeOrderingOperating,
          }
        : undefined,
    [getCollectedForSession, isByItemPerTicket, request, t, unlockTicket, unlockingKeys],
  );
  const discountReasonOptionsList = useMemo(
    () => abnormalReasonOptions(lang, 'discount'),
    [lang],
  );
  const supabase = useMemo(() => createClient(), []);
  const [sessionOrders, setSessionOrders] = useState<Order[]>([]);
  const [ordersReady, setOrdersReady] = useState(false);
  const [itemCodeByMenuId, setItemCodeByMenuId] = useState<Record<string, string>>({});
  const [imageUrlByMenuId, setImageUrlByMenuId] = useState<Record<string, string>>({});
  const [resumeConfirmOpen, setResumeConfirmOpen] = useState(false);
  const [tableBuffetModel, setTableBuffetModel] = useState<WaiterTablePageModel | null>(null);
  const [buffetModelReady, setBuffetModelReady] = useState(false);
  const [acknowledgedZeroHeadcount, setAcknowledgedZeroHeadcount] = useState(false);
  const [zeroHeadcountPromptOpen, setZeroHeadcountPromptOpen] = useState(false);
  const [headcountAdjustOpen, setHeadcountAdjustOpen] = useState(false);
  const [headcountAdjustBusy, setHeadcountAdjustBusy] = useState(false);
  const { printFiscalInvoiceAvailable } = useStaffPrintFiscalInvoice({
    restaurantSlug,
    billSplitId: request.id,
    enabled: canPrintFiscalInvoice,
    labels: {
      printInvoiceSuccess: t.printInvoiceSuccess,
      printInvoiceFailed: t.printInvoiceFailed,
      printInvoiceDisabled: t.printInvoiceDisabled,
    },
  });

  const loadSessionOrders = useCallback(async () => {
    if (!restaurantId || !request.session_id) {
      setSessionOrders([]);
      setItemCodeByMenuId({});
      setImageUrlByMenuId({});
      setOrdersReady(true);
      return;
    }
    const { data: orderRows, error } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('session_id', request.session_id);

    if (error) {
      setSessionOrders([]);
      setItemCodeByMenuId({});
      setImageUrlByMenuId({});
      setOrdersReady(true);
      return;
    }

    const orders = (orderRows || []) as Order[];
    const menuItemIds = distinctMenuItemIdsFromOrders(orders);
    let codes: Record<string, string> = {};
    let images: Record<string, string> = {};
    if (menuItemIds.length > 0) {
      const { data: menuRows } = await supabase
        .from('menu_items')
        .select('id, item_code, image_url')
        .eq('restaurant_id', restaurantId)
        .in('id', menuItemIds);
      codes = menuItemCodeLookupFromRows(menuRows ?? []);
      images = menuItemImageUrlLookupFromRows(menuRows ?? []);
    }

    setSessionOrders(orders);
    setItemCodeByMenuId(codes);
    setImageUrlByMenuId(images);
    setOrdersReady(true);
  }, [restaurantId, request.session_id, supabase]);

  useEffect(() => {
    setOrdersReady(false);
    let cancelled = false;
    void loadSessionOrders().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
    // Reload when checkout bill may have changed (resume → reorder → new request).
  }, [loadSessionOrders, request.id, request.total_amount]);

  useEffect(() => {
    setBuffetModelReady(false);
    setTableBuffetModel(null);
    let cancelled = false;
    void fetchWaiterTablePageModelClient(restaurantSlug, request.table_id)
      .then((model) => {
        if (cancelled) return;
        setTableBuffetModel(model);
        setBuffetModelReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setTableBuffetModel(null);
        setBuffetModelReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantSlug, request.table_id]);

  const activeBuffets = useMemo(
    () => (tableBuffetModel ? activeBuffetsFromModel(tableBuffetModel) : []),
    [tableBuffetModel],
  );
  const restaurantHasActiveBuffets = activeBuffets.length > 0;
  const guestCountConfirmed = isBillGuestCountConfirmed(sessionOrders);

  useEffect(() => {
    if (!ordersReady || !buffetModelReady) return;
    if (zeroHeadcountPromptOpen || headcountAdjustOpen) return;
    if (
      !shouldPromptCheckoutZeroHeadcount({
        restaurantHasActiveBuffets,
        guestCountConfirmed,
        acknowledgedZeroHeadcount,
      })
    ) {
      return;
    }
    setZeroHeadcountPromptOpen(true);
  }, [
    acknowledgedZeroHeadcount,
    buffetModelReady,
    guestCountConfirmed,
    headcountAdjustOpen,
    ordersReady,
    restaurantHasActiveBuffets,
    zeroHeadcountPromptOpen,
  ]);

  const refreshBillAfterHeadcount = useCallback(
    async (nextOrders: Order[]) => {
      const mode = request.split_mode;
      const payload =
        mode === 'whole_table'
          ? buildWholeTableCheckoutPayload(0)
          : {
              splitMode: mode,
              persons: request.persons ?? [],
              result: request.result ?? [],
            };
      const outcome = await requestCheckoutRequest({
        slug: restaurantSlug,
        tableId: request.table_id,
        splitMode: payload.splitMode,
        persons: payload.persons,
        result: payload.result,
        allowPartialByItem: mode === 'by_item',
      });
      if (!outcome.ok) {
        showToast(
          messageForCheckoutRequestError(outcome.error, {
            guestCountRequired: t.callCheckoutGuestCountRequired,
            partyMergeRequired: t.callCheckoutPartyMergeRequired,
            emptySession: t.callCheckoutEmptySession,
            noActiveSession: t.callCheckoutNoActiveSession,
            tableNotAvailable: t.callCheckoutTableNotAvailable,
            invalidNif: billT.nifInvalid,
            splitPlanLocked: billT.splitPlanLocked,
            fallback: t.callCheckoutFailed,
          }),
          'error',
        );
        return false;
      }
      const nextTotal = sumBillableSessionTotal(nextOrders);
      upsertRequestFromSubmit({
        ...request,
        id: outcome.bill_split_id,
        split_mode: payload.splitMode,
        persons: payload.persons,
        result: outcome.result,
        total_amount: nextTotal,
        status: 'requested',
      });
      void reload();
      setSessionOrders(nextOrders);
      return true;
    },
    [billT, reload, request, restaurantSlug, t, upsertRequestFromSubmit],
  );

  const confirmHeadcountAdjust = useCallback(
    async (snapshot: BuffetGuestSnapshot) => {
      if (headcountAdjustBusy) return;
      setHeadcountAdjustBusy(true);
      try {
        const result = await postWaiterBuffetOpenAndCommit({
          restaurantSlug,
          tableId: request.table_id,
          guestSnapshot: snapshot,
          activeBuffetIds: activeBuffets.map((b) => b.id),
          intent: buffetWaiterOpenIntentFromSession(true),
        });
        if (!result.ok) {
          toastWaiterBuffetOpenFailure(WAITER_TEXT[lang], result);
          return;
        }
        const nextOrders = (result.model.detail.orders ?? []) as Order[];
        const ok = await refreshBillAfterHeadcount(nextOrders);
        if (!ok) return;
        setAcknowledgedZeroHeadcount(true);
        setHeadcountAdjustOpen(false);
        setZeroHeadcountPromptOpen(false);
        syncBoardAfterMutation(request.table_id);
        // Refresh buffet prices / packages for this detail visit.
        setTableBuffetModel(result.model);
      } finally {
        setHeadcountAdjustBusy(false);
      }
    },
    [
      activeBuffets,
      headcountAdjustBusy,
      lang,
      refreshBillAfterHeadcount,
      request.table_id,
      restaurantSlug,
      syncBoardAfterMutation,
    ],
  );

  const collectedPayments = getCollectedForSession(request.session_id);

  const getDiscountRate = (row: BillSplit) =>
    billDiscount.getDisplayRate(row.id, row.discount_rate ?? 0);

  const patchRequestDiscount = useCallback(
    (
      requestId: string,
      discount: {
        discount_rate: number;
        discount_reason: string | null;
        discount_reason_detail: string | null;
      },
    ) => {
      updateRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, ...discount } : r)),
      );
      billDiscount.finishSetup(requestId);
    },
    [billDiscount, updateRequests],
  );

  const persistDiscount = useCallback(
    async (
      row: BillSplit,
      rate: number,
      reason?: string,
      detail?: string,
    ) => {
      if (!restaurantSlug) {
        showToast('操作失败，请重试', 'error');
        return false;
      }
      billDiscount.setApplying(row.id);
      try {
        const outcome = await requestCheckoutApplyDiscount({
          slug: restaurantSlug,
          billSplitId: row.id,
          discountRate: rate,
          ...(reason ? { discountReason: reason } : {}),
          ...(detail ? { discountReasonDetail: detail } : {}),
        });
        if (!outcome.ok) {
          const message = messageForCheckoutErrorOverrides(
            outcome.error,
            {
              reason_required: t.discountReasonRequired,
              reason_detail_required: t.discountReasonDetailRequired,
              discount_locked_after_payment: t.discountLockedAfterPayment,
            },
            '操作失败，请重试',
          );
          showToast(message, 'error');
          return false;
        }
        patchRequestDiscount(row.id, outcome);
        return true;
      } catch {
        showToast('操作失败，请重试', 'error');
        return false;
      } finally {
        billDiscount.setApplying(null);
      }
    },
    [billDiscount, patchRequestDiscount, restaurantSlug, t],
  );

  const commitDiscountRate = useCallback(
    (row: BillSplit, rate: number) => {
      const decision = billDiscount.commitRate(
        row.id,
        rate,
        row.discount_rate ?? 0,
        row.discount_reason,
      );
      if (decision.kind === 'needs_reason') return;
      if (decision.kind === 'clear_draft') {
        billDiscount.finishSetup(row.id);
        return;
      }
      void persistDiscount(
        row,
        decision.rate,
        row.discount_reason ?? undefined,
        row.discount_reason_detail ?? undefined,
      );
    },
    [billDiscount, persistDiscount],
  );

  const discountRate = getDiscountRate(request);
  const summary = buildCheckoutSettlementSummary(request, discountRate, collectedPayments);

  const confirmCollectedPerson = async (
    row: BillSplit,
    pending: {
      rowIndex: number;
      amount: number;
      wholeTable: boolean;
      personName?: string;
      partyId?: string;
    },
    input: CollectPaymentConfirmInput,
  ) => {
    if (!restaurantSlug) {
      showToast('操作失败，请重试', 'error');
      return;
    }
    let rowIndex = pending.rowIndex;
    let amount = pending.amount;
    const personKey = checkoutPersonKey(row.id, rowIndex);
    setProcessingKeys((prev) => new Set(prev).add(personKey));
    try {
      // By-item: upsert current ticket only; modal amount is authoritative (no whole-table recalc).
      if (pending.personName && persistCollectTicket.current) {
        const ticket = await persistCollectTicket.current({
          personName: pending.personName,
          partyId: pending.partyId,
          modalAmount: pending.amount,
        });
        if (!ticket) return;
        rowIndex = ticket.personIndex;
        amount = pending.amount;
      } else if (persistBeforePay.current) {
        // Even: persist full split plan before collect (unchanged).
        const persisted = await persistBeforePay.current();
        if (!persisted) return;
        if (pending.personName) {
          const idx = persisted.result.findIndex(
            (entry) =>
              splitPartyKey(entry.party_id, entry.name) ===
              splitPartyKey(pending.partyId, pending.personName ?? ''),
          );
          if (idx >= 0) rowIndex = idx;
        }
      } else if (pending.personName) {
        const idx = (row.result ?? []).findIndex(
          (entry) =>
            splitPartyKey(entry.party_id, entry.name) ===
            splitPartyKey(pending.partyId, pending.personName ?? ''),
        );
        if (idx >= 0) rowIndex = idx;
      }
      const billSplitId = persistedBillSplitId.current ?? row.id;
      const attemptFingerprint = collectAttemptFingerprint({
        billSplitId,
        personIndex: rowIndex,
        amount,
        paymentMethod: input.paymentMethod,
        paymentLines: input.payment_lines,
      });
      const outcome = await requestCheckoutConfirmPayment({
        slug: restaurantSlug,
        billSplitId,
        personIndex: rowIndex,
        paymentMethod: input.paymentMethod,
        paymentLines: input.payment_lines,
        collectedAmount: amount,
        clientRequestId: collectAttempts.idFor(attemptFingerprint),
      });
      if (outcome.ok) collectAttempts.settle(attemptFingerprint);
      if (!outcome.ok || !outcome.collection) {
        showToast(
          outcome.ok
            ? '操作失败，请重试'
            : messageForCheckoutErrorOverrides(outcome.error, { already_paid: t.paid }, '操作失败，请重试'),
          'error',
        );
        return;
      }
      const printAsk = {
        billSplitId,
        sessionId: row.session_id ?? '',
        tableId: row.table_id,
        discountRate: row.discount_rate ?? 0,
        fiscal: printFiscalInvoiceAvailable,
        wholeTable: pending.wholeTable,
        allPaid: outcome.all_paid,
        personName: outcome.collection.person_name,
        partyId:
          pending.partyId ??
          (row.result ?? [])[rowIndex]?.party_id ??
          undefined,
        obligation: amount,
        paymentMethod: input.paymentMethod,
        payment_lines: input.payment_lines,
        customerNif: input.customerNif,
        customerName: input.customerName,
        cashTendered: input.cashTendered,
        collection: outcome.collection,
        autoIssueFiscal: shouldAutoIssueFiscalAfterCollect({
          fiscal: printFiscalInvoiceAvailable,
          paymentMethod: input.paymentMethod,
          customerNif: input.customerNif,
        }),
      };
      // Persist before React state so RSC remount / Fast Refresh cannot drop the ask.
      writePendingCheckoutPrintAsk(printAsk);
      setPrintAsk(printAsk);
      applyConfirmPaymentOutcome({
        billSplitId,
        sessionId: row.session_id,
        outcome: {
          all_paid: outcome.all_paid,
          result: outcome.result,
          final_amount: outcome.final_amount,
          collection: outcome.collection,
        },
        printAsk,
        heldRow: row,
      });
      syncBoardAfterMutation(row.table_id);
    } catch {
      showToast('操作失败，请重试', 'error');
    } finally {
      setProcessingKeys((prev) => {
        const next = new Set(prev);
        next.delete(personKey);
        return next;
      });
    }
  };

  const resumeConfirmMessage = useMemo(() => {
    const variant = resumeOrderingConfirmVariant(request, collectedPayments);
    if (variant === 'preserve_by_item') return t.resumeOrderingConfirmPreserveByItem;
    if (variant === 'preserve_with_collections') return t.resumeOrderingConfirmPreserveWithCollections;
    return t.resumeOrderingConfirmCancel;
  }, [request, collectedPayments, t]);
  const discountApplying = billDiscount.applyingRequestId === request.id;
  const paymentMethodLabels = useMemo(
    () =>
      ({
        CASH: t.paymentMethodCash,
        MULTIBANCO: t.paymentMethodMultibanco,
        MIXED: t.paymentMethodMixed,
      }) satisfies Record<BillSyncPaymentMethod, string>,
    [t],
  );

  const detailLocked =
    isResumeBusy ||
    isCheckoutDetailLocked(processingKeys, request.id) ||
    discountApplying;

  return (
    <>
      <StaffCheckoutSplitEditor
        restaurantId={restaurantId}
        restaurantSlug={restaurantSlug}
        request={request}
        sessionOrders={sessionOrders}
        itemCodeByMenuId={itemCodeByMenuId}
        imageUrlByMenuId={imageUrlByMenuId}
        collectedPayments={collectedPayments}
        summary={summary}
        discountRate={discountRate}
        discountApplying={discountApplying}
        discountLocked={hasConfirmedPerson(request)}
        detailLocked={detailLocked}
        resumeOperating={isResumeMutating}
        showBackButton={showBackButton}
        stickyShellClass={stickyShellClass}
        onBack={onBack}
        onCancel={exitToTableDetail}
        onDiscountRateCommit={(next) => commitDiscountRate(request, next)}
        onDiscountRateFocus={() =>
          billDiscount.handleRateFocus(request.id, request.discount_rate ?? 0)
        }
        onResumeOrderingClick={() => setResumeConfirmOpen(true)}
        ticketUnlock={ticketUnlock}
        onCollectPerson={(index, amount, personName, partyId, preDiscountAmount, wholeTable) => {
          setCollectPending({
            rowIndex: index,
            amount,
            wholeTable: wholeTable ?? isWholeTableSplit(request),
            personName,
            partyId,
            preDiscountAmount,
          });
        }}
        onSplitPersisted={(row) => {
          persistedBillSplitId.current = row.id;
          upsertRequestFromSubmit(row);
        }}
        onRegisterPersist={(persist) => {
          persistBeforePay.current = persist;
        }}
        onRegisterCollectTicket={(persist) => {
          persistCollectTicket.current = persist;
        }}
      />
      <ReasonConfirmDialog
        open={billDiscount.pendingSetup != null}
        onClose={billDiscount.cancelSetup}
        title={t.discountReasonTitle}
        message={t.discountReasonMessage}
        reasonLabel={t.discountReasonLabel}
        detailLabel={t.discountReasonDetailLabel}
        detailPlaceholder={t.discountReasonDetailPlaceholder}
        confirmLabel={t.discountReasonConfirm}
        cancelLabel={t.discountReasonCancel}
        reasonRequiredError={t.discountReasonRequired}
        detailRequiredError={t.discountReasonDetailRequired}
        reasons={discountReasonOptionsList}
        reasonGroup="discount"
        confirming={billDiscount.applyingRequestId != null}
        onConfirm={async (reason, detail) => {
          const setup = billDiscount.pendingSetup;
          if (!setup) return;
          await persistDiscount(request, setup.rate, reason, detail);
        }}
      />
      <ConfirmModal
        open={resumeConfirmOpen}
        onClose={() => {
          if (isResumeBusy) return;
          setResumeConfirmOpen(false);
        }}
        title={t.resumeOrderingConfirmTitle}
        message={resumeConfirmMessage}
        confirmLabel={t.resumeOrdering}
        cancelLabel={t.resumeOrderingCancel}
        confirming={isResumeMutating}
        onConfirm={() => {
          void resumeOrdering().finally(() => setResumeConfirmOpen(false));
        }}
      />
      <ConfirmModal
        open={zeroHeadcountPromptOpen}
        onClose={() => {
          // Closing without confirm opens headcount adjust (product: 否 → 调整人数).
          setZeroHeadcountPromptOpen(false);
          setHeadcountAdjustOpen(true);
        }}
        title={t.zeroHeadcountConfirmTitle}
        message={t.zeroHeadcountConfirmMessage}
        confirmLabel={t.zeroHeadcountConfirm}
        cancelLabel={t.zeroHeadcountAdjust}
        onConfirm={() => {
          setAcknowledgedZeroHeadcount(true);
          setZeroHeadcountPromptOpen(false);
        }}
      />
      <CheckoutHeadcountAdjustModal
        open={headcountAdjustOpen}
        lang={lang}
        activeBuffets={activeBuffets}
        buffetPricesByBuffetId={tableBuffetModel?.buffetPricesByBuffetId ?? {}}
        sessionOrders={sessionOrders}
        busy={headcountAdjustBusy}
        labels={{
          title: t.zeroHeadcountAdjustTitle,
          confirm: t.zeroHeadcountAdjustConfirm,
          cancel: t.zeroHeadcountAdjustCancel,
          needHeadcount: t.zeroHeadcountNeedCount,
        }}
        onClose={() => {
          if (headcountAdjustBusy) return;
          setHeadcountAdjustOpen(false);
          // Still zero and not acknowledged → re-show soft confirm.
          if (
            shouldPromptCheckoutZeroHeadcount({
              restaurantHasActiveBuffets,
              guestCountConfirmed: isBillGuestCountConfirmed(sessionOrders),
              acknowledgedZeroHeadcount,
            })
          ) {
            setZeroHeadcountPromptOpen(true);
          }
        }}
        onConfirm={(snapshot) => {
          void confirmHeadcountAdjust(snapshot);
        }}
      />
      <CollectPaymentModal
        open={collectPending != null}
        busy={
          collectPending != null &&
          processingKeys.has(checkoutPersonKey(request.id, collectPending.rowIndex))
        }
        amount={collectPending?.amount ?? 0}
        preDiscountAmount={collectPending?.preDiscountAmount}
        discountRate={discountRate}
        initialCustomerName={collectPaymentInitialCustomerName(collectPending?.personName)}
        labels={{
          title: t.collectPaymentTitle,
          amount: t.collectPaymentAmount,
          discountDetail: t.collectDiscountDetail,
          paymentMethod: t.printInvoicePaymentMethod,
          confirm: t.confirmOnePaid,
          cancel: t.printInvoiceCancel,
          cashReceived: t.cashReceived,
          changeDue: t.changeDue,
          cashShort: t.cashShort,
          multibancoAmount: t.multibancoAmount,
          cashRemainder: t.cashRemainder,
          mixedNeedBothSides: t.mixedNeedBothSides,
        }}
        fiscalLabels={
          printFiscalInvoiceAvailable
            ? {
                nif: t.printInvoiceNif,
                nifOptional: t.printInvoiceOptional,
                nifInvalid: billT.nifInvalid,
                name: t.printInvoiceName,
                nameOptional: t.printInvoiceOptional,
                documentTypeHint: t.printInvoiceDocumentTypeHint,
              }
            : null
        }
        paymentLabels={paymentMethodLabels}
        onClose={() => {
          if (
            collectPending != null &&
            processingKeys.has(checkoutPersonKey(request.id, collectPending.rowIndex))
          ) {
            return;
          }
          setCollectPending(null);
        }}
        onConfirm={(input) => {
          if (!collectPending) return;
          const pending = collectPending;
          setCollectPending(null);
          void confirmCollectedPerson(request, pending, input);
        }}
      />
    </>
  );
}
