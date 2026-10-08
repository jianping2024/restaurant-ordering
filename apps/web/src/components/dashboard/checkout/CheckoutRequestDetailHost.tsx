'use client';

import {
  unlockableIndividualTicketKeys,
  type StaffTicketUnlock,
} from '@/components/dashboard/checkout/staff-ticket-unlock';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { checkoutSplitModeUiLabels } from '@/lib/i18n/guest-split-mode-messages';
import type { BillSplit, Order, SplitPerson, SplitResult } from '@/types';
import { showToast } from '@/components/ui/Toast';
import { ReasonConfirmDialog } from '@/components/ui/ReasonConfirmDialog';
import {
  checkoutPersonKey,
  isCheckoutDetailLocked,
} from '@/lib/checkout-request-state';
import { normalizeSplitRows } from '@/lib/checkout-split-math';
import {
  collectPaymentInitialCustomerName,
  shouldAutoIssueFiscalAfterCollect,
} from '@/lib/checkout-print-ask';
import { splitPartyKey } from '@/lib/split-party-id';
import { isWholeTablePayerName } from '@/lib/split-person-label';
import {
  hasConfirmedPerson,
  resumeCheckoutBlockReason,
  resumeOrderingConfirmVariant,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import {
  buildSplitSettlementRows,
  isMultiPersonSplitBill,
  isSplitSettlementPending,
  pendingSplitSettlementRows,
} from '@/lib/checkout-split-settlement';
import { prepareStaffCheckoutResumeOrdering } from '@/lib/checkout-resume-ordering-gate';
import { logCheckoutResumeFailure } from '@/lib/checkout-resume-failure-log';
import {
  messageForCheckoutErrorOverrides,
  messageForCheckoutRequestError,
} from '@/lib/checkout-request-error-message';
import { requestCheckoutRequest } from '@/lib/request-checkout-request';
import { useCheckoutResumeOrdering } from '@/lib/use-checkout-resume-ordering';
import { useIndividualTicketUnlock } from '@/lib/use-individual-ticket-unlock';
import {
  staffSplitReceiptCooldownKey,
  useStaffCheckoutBillPrint,
} from '@/lib/use-staff-checkout-bill-print';
import { mayFiscalBillQueue } from '@/lib/bill-sync-permission';
import { useStaffPrintFiscalInvoice } from '@/lib/use-staff-print-fiscal-invoice';
import { CollectPaymentModal, type CollectPaymentConfirmInput } from '@/components/dashboard/checkout/CollectPaymentModal';
import { PrintFiscalInvoiceModal } from '@/components/dashboard/checkout/PrintFiscalInvoiceModal';
import type { BillSyncPaymentMethod } from '@/lib/bill-sync-payload';
import { billSyncByItemScopeId } from '@/lib/bill-sync-scope-id';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { abnormalReasonOptions } from '@/lib/audit/reason-labels';
import { useCheckoutBillDiscount } from '@/lib/checkout-discount/use-checkout-bill-discount';
import { requestCheckoutApplyDiscount } from '@/lib/request-checkout-apply-discount';
import { requestCheckoutConfirmPayment } from '@/lib/request-checkout-confirm-payment';
import { collectAttemptFingerprint, createCollectAttemptIds } from '@/lib/collect-attempt-ids';
import { writePendingCheckoutPrintAsk } from '@/lib/checkout-print-ask-store';
import {
  checkoutLinesFromOrders,
  type CheckoutDisplayLine,
} from '@/lib/checkout-session-lines';
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { menuItemImageUrlLookupFromRows } from '@/lib/menu-image';
import { CheckoutRequestDetail } from '@/components/dashboard/checkout/CheckoutRequestDetail';
import {
  buildCheckoutSettlementSummary,
  checkoutSplitModeLabel,
  hasCheckoutCollections,
} from '@/lib/checkout-settlement';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { useWaiterBoardOptional } from '@/components/dashboard/WaiterBoardProvider';
import type { Capabilities } from '@/lib/permissions/can';
import {
  canReturnToCheckoutPathChooser,
  CheckoutPathChooser,
  resolveCheckoutDetailPhase,
  type StaffCheckoutPathChoice,
} from '@/components/dashboard/checkout/checkout-detail-phase';
import { StaffCheckoutSplitEditor } from '@/components/dashboard/checkout/StaffCheckoutSplitEditor';
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
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceScopeId, setInvoiceScopeId] = useState<string | undefined>(undefined);
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [invoiceInitialPayment, setInvoiceInitialPayment] =
    useState<BillSyncPaymentMethod | null>(null);
  const [collectPending, setCollectPending] = useState<{
    rowIndex: number;
    amount: number;
    wholeTable: boolean;
    personName?: string;
    partyId?: string;
    /** Ticket pre-discount obligation for collect modal discount line. */
    preDiscountAmount?: number;
  } | null>(null);
  const [pathChoice, setPathChoice] = useState<StaffCheckoutPathChoice>('undecided');
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
      collecting: t.resumeOrderingTicketCollecting,
    },
  });
  const isIndividualPlan = request.individual_tickets !== undefined;
  const ticketUnlock = useMemo<StaffTicketUnlock | undefined>(
    () =>
      isIndividualPlan
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
    [getCollectedForSession, isIndividualPlan, request, t, unlockTicket, unlockingKeys],
  );
  const discountReasonOptionsList = useMemo(
    () => abnormalReasonOptions(lang, 'discount'),
    [lang],
  );
  const supabase = useMemo(() => createClient(), []);
  const [selectedLines, setSelectedLines] = useState<CheckoutDisplayLine[]>([]);
  const [sessionOrders, setSessionOrders] = useState<Order[]>([]);
  const [itemCodeByMenuId, setItemCodeByMenuId] = useState<Record<string, string>>({});
  const [imageUrlByMenuId, setImageUrlByMenuId] = useState<Record<string, string>>({});
  const [resumeConfirmOpen, setResumeConfirmOpen] = useState(false);
  const {
    printSplitReceipt,
    isPrintReceiptBusy,
    cooldownSecondsLeft,
    isOnCooldown,
  } = useStaffCheckoutBillPrint(restaurantSlug);
  const {
    printFiscalInvoiceAvailable,
    printFiscalInvoiceBusy,
    printFiscalInvoice,
    requestPrintFiscalInvoice,
  } = useStaffPrintFiscalInvoice({
    restaurantSlug,
    billSplitId: request.id,
    enabled: canPrintFiscalInvoice,
    labels: {
      printInvoiceSuccess: t.printInvoiceSuccess,
      printInvoiceFailed: t.printInvoiceFailed,
      printInvoiceDisabled: t.printInvoiceDisabled,
    },
  });

  useEffect(() => {
    if (!restaurantId || !request.session_id) {
      setSelectedLines([]);
      setSessionOrders([]);
      setItemCodeByMenuId({});
      setImageUrlByMenuId({});
      return;
    }

    let cancelled = false;
    const loadLines = async () => {
      const { data: orderRows, error } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('session_id', request.session_id);

      if (cancelled) return;
      if (error) {
        setSelectedLines([]);
        setSessionOrders([]);
        setItemCodeByMenuId({});
        setImageUrlByMenuId({});
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
      setSelectedLines(checkoutLinesFromOrders(orders, lang, codes));
    };

    void loadLines();
    return () => {
      cancelled = true;
    };
    // Reload when checkout bill may have changed (resume → reorder → new request).
  }, [
    supabase,
    restaurantId,
    request.session_id,
    request.id,
    request.total_amount,
    lang,
  ]);

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

  const splitModeLabels = useMemo(
    () => checkoutSplitModeUiLabels(lang, t.splitModeWhole),
    [lang, t.splitModeWhole],
  );

  const discountRate = getDiscountRate(request);
  const settlementRows = useMemo(
    () =>
      buildSplitSettlementRows(
        normalizeSplitRows(request),
        collectedPayments,
        discountRate,
        request.total_amount,
      ),
    [request, collectedPayments, discountRate],
  );
  const summary = buildCheckoutSettlementSummary(request, discountRate, collectedPayments);
  const splitModeLabel = checkoutSplitModeLabel(request.split_mode, splitModeLabels);
  const pendingSettlementRows = useMemo(
    () => pendingSplitSettlementRows(settlementRows),
    [settlementRows],
  );

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

  const partialPaid = hasCheckoutCollections(request, collectedPayments);
  const resumeBlockReason = resumeCheckoutBlockReason(request, collectedPayments);
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

  const openInvoiceModal = useCallback(
    (
      scopeId?: string,
      initialPayment: BillSyncPaymentMethod | null = null,
      amount = 0,
    ) => {
      setInvoiceScopeId(scopeId);
      setInvoiceInitialPayment(initialPayment);
      setInvoiceAmount(amount);
      setInvoiceModalOpen(true);
    },
    [],
  );

  const openSplitInvoice = useCallback(
    (payment: SessionCollectedPayment) => {
      const name = payment.person_name?.trim();
      if (!name) return;
      const rosterRow =
        payment.person_index != null && payment.person_index >= 0
          ? request.result?.[payment.person_index]
          : undefined;
      const scopeId = billSyncByItemScopeId(
        request.id,
        name,
        rosterRow?.party_id,
      );
      void requestPrintFiscalInvoice({ issueScopeId: scopeId }).then((result) => {
        if (result === 'need_issue') {
          openInvoiceModal(scopeId, payment.payment_method, payment.amount);
        }
      });
    },
    [openInvoiceModal, request.id, request.result, requestPrintFiscalInvoice],
  );

  const showSplitReceiptActions = isMultiPersonSplitBill(request);
  const detailPhase = resolveCheckoutDetailPhase({
    splitMode: request.split_mode,
    collected: summary.collected,
    pathChoice,
  });
  const returnToPathChooser = () => setPathChoice('undecided');
  const showReturnToPathChooser = canReturnToCheckoutPathChooser({
    splitMode: request.split_mode,
    collected: summary.collected,
    pathChoice,
  });

  const detailLocked =
    isResumeBusy ||
    isCheckoutDetailLocked(processingKeys, request.id) ||
    discountApplying ||
    printFiscalInvoiceBusy;

  return (
    <>
      {detailPhase === 'path_chooser' ? (
        <div className="mb-3 space-y-3">
          {showBackButton ? (
            <button
              type="button"
              onClick={onBack}
              className="text-sm font-semibold text-brand-text-muted hover:text-brand-text lg:hidden"
            >
              ← {t.backToList}
            </button>
          ) : null}
          <CheckoutPathChooser
            wholeTableLabel={t.pathChooserWholeTable}
            splitLabel={t.pathChooserSplit}
            resumeLabel={isIndividualPlan ? undefined : t.resumeOrdering}
            onWholeTable={() => setPathChoice('whole_table')}
            onSplit={() => setPathChoice('split')}
            onResume={isIndividualPlan ? undefined : () => setResumeConfirmOpen(true)}
          />
        </div>
      ) : null}
      {detailPhase === 'split_edit' ? (
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
          resumeBlockReason={resumeBlockReason}
          showPathBack={showReturnToPathChooser}
          showBackButton={showBackButton}
          stickyShellClass={stickyShellClass}
          onBack={onBack}
          onCancel={returnToPathChooser}
          onDiscountRateCommit={(next) => commitDiscountRate(request, next)}
          onDiscountRateFocus={() =>
            billDiscount.handleRateFocus(request.id, request.discount_rate ?? 0)
          }
          onResumeOrderingClick={() => setResumeConfirmOpen(true)}
          ticketUnlock={ticketUnlock}
          onCollectPerson={(index, amount, personName, partyId, preDiscountAmount) => {
            setCollectPending({
              rowIndex: index,
              amount,
              wholeTable: false,
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
      ) : null}
      {detailPhase === 'settle' ? (
      <CheckoutRequestDetail
        request={request}
        summary={summary}
        splitModeLabel={splitModeLabel}
        partialPaid={partialPaid}
        collectedPayments={collectedPayments}
        settlementRows={settlementRows}
        pendingSettlementRows={pendingSettlementRows}
        selectedLines={selectedLines}
        sessionOrders={sessionOrders}
        itemCodeByMenuId={itemCodeByMenuId}
        processingKeys={processingKeys}
        detailLocked={detailLocked}
        resumeOperating={isResumeMutating}
        discountRate={discountRate}
        discountApplying={discountApplying}
        discountLocked={hasConfirmedPerson(request)}
        resumeBlockReason={resumeBlockReason}
        printInvoiceAvailable={printFiscalInvoiceAvailable}
        showSplitReceiptActions={showSplitReceiptActions}
        onPrintSplitReceipt={(payment) => void printSplitReceipt(request, payment)}
        onPrintSplitInvoice={openSplitInvoice}
        isPrintReceiptBusy={(payment) =>
          payment.person_index != null && isPrintReceiptBusy(request.id, payment.person_index)
        }
        printReceiptCooldownSeconds={(payment) =>
          payment.person_index != null
            ? cooldownSecondsLeft(
                staffSplitReceiptCooldownKey(request.id, payment.person_index),
              )
            : 0
        }
        isPrintReceiptOnCooldown={(payment) =>
          payment.person_index != null &&
          isOnCooldown(staffSplitReceiptCooldownKey(request.id, payment.person_index))
        }
        showBackButton={showBackButton}
        stickyShellClass={stickyShellClass}
        lang={lang}
        t={t}
        onBack={onBack}
        onReturnToPathChooser={
          detailPhase === 'settle' && showReturnToPathChooser
            ? returnToPathChooser
            : undefined
        }
        onDiscountRateCommit={(next) => commitDiscountRate(request, next)}
        onDiscountRateFocus={() =>
          billDiscount.handleRateFocus(request.id, request.discount_rate ?? 0)
        }
        onConfirmPersonPaid={(index) => {
          const settlementRow = settlementRows.find((entry) => entry.index === index);
          if (!settlementRow || !isSplitSettlementPending(settlementRow)) {
            showToast(t.paid, 'error');
            return;
          }
          const rawName = request.result?.[index]?.name;
          setCollectPending({
            rowIndex: index,
            amount: settlementRow.outstandingAmount,
            wholeTable: true,
            personName:
              rawName && !isWholeTablePayerName(rawName) ? rawName.trim() : undefined,
            preDiscountAmount: Number(request.result?.[index]?.amount ?? 0),
          });
        }}
        onResumeOrderingClick={() => setResumeConfirmOpen(true)}
        ticketUnlock={ticketUnlock}
        paymentLabels={paymentMethodLabels}
      />
      ) : null}      <ReasonConfirmDialog
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
      <PrintFiscalInvoiceModal
        open={invoiceModalOpen}
        busy={printFiscalInvoiceBusy}
        amount={invoiceAmount}
        initialPaymentMethod={invoiceInitialPayment}
        labels={{
          title: t.printInvoiceModalTitle,
          nif: t.printInvoiceNif,
          nifOptional: t.printInvoiceOptional,
          nifInvalid: billT.nifInvalid,
          name: t.printInvoiceName,
          nameOptional: t.printInvoiceOptional,
          paymentMethod: t.printInvoicePaymentMethod,
          documentTypeHint: t.printInvoiceDocumentTypeHint,
          confirm: t.printInvoice,
          cancel: t.printInvoiceCancel,
          cashReceived: t.cashReceived,
          changeDue: t.changeDue,
          cashShort: t.cashShort,
          multibancoAmount: t.multibancoAmount,
          cashRemainder: t.cashRemainder,
          mixedNeedBothSides: t.mixedNeedBothSides,
        }}
        paymentLabels={paymentMethodLabels}
        onClose={() => {
          if (printFiscalInvoiceBusy) return;
          setInvoiceModalOpen(false);
        }}
        onConfirm={(input) => {
          void printFiscalInvoice({
            paymentMethod: input.paymentMethod,
            paymentLines: input.payment_lines,
            amount: invoiceAmount,
            customerNif: input.customerNif,
            customerName: input.customerName,
            issueScopeId: invoiceScopeId,
          }).finally(() => setInvoiceModalOpen(false));
        }}
      />
    </>
  );
}
