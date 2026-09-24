'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { checkoutSplitModeUiLabels } from '@/lib/i18n/guest-split-mode-messages';
import type { BillSplit, Order } from '@/types';
import { showToast } from '@/components/ui/Toast';
import { ReasonConfirmDialog } from '@/components/ui/ReasonConfirmDialog';
import {
  checkoutPersonKey,
  isCheckoutDetailLocked,
} from '@/lib/checkout-request-state';
import { discountedSplitRows } from '@/lib/checkout-split-math';
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
import { useCheckoutResumeOrdering } from '@/lib/use-checkout-resume-ordering';
import {
  staffBillPrintCooldownKey,
  staffSplitReceiptCooldownKey,
  useStaffCheckoutBillPrint,
} from '@/lib/use-staff-checkout-bill-print';
import { mayFiscalBillQueue } from '@/lib/bill-sync-permission';
import { useStaffPrintFiscalInvoice } from '@/lib/use-staff-print-fiscal-invoice';
import { PrintFiscalInvoiceModal } from '@/components/dashboard/checkout/PrintFiscalInvoiceModal';
import { billSyncByItemScopeId } from '@/lib/bill-sync-scope-id';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { abnormalReasonOptions } from '@/lib/audit/reason-labels';
import { useCheckoutBillDiscount } from '@/lib/checkout-discount/use-checkout-bill-discount';
import { requestCheckoutApplyDiscount } from '@/lib/request-checkout-apply-discount';
import { requestCheckoutConfirmPayment } from '@/lib/request-checkout-confirm-payment';
import {
  checkoutLinesFromOrders,
  type CheckoutDisplayLine,
} from '@/lib/checkout-session-lines';
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { CheckoutRequestDetail } from '@/components/dashboard/checkout/CheckoutRequestDetail';
import {
  buildCheckoutSettlementSummary,
  checkoutSplitModeLabel,
  hasCheckoutCollections,
} from '@/lib/checkout-settlement';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { useWaiterBoardOptional } from '@/components/dashboard/WaiterBoardProvider';
import type { Capabilities } from '@/lib/permissions/can';
import { mayForceCloseTable } from '@/lib/table-session/force-close-table-policy';
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
  /** Called after the queue row is removed because everyone paid. */
  onAllPaid?: () => void;
  onCloseTableComplete?: () => void;
};

export function CheckoutRequestDetailHost({
  request,
  restaurantId,
  restaurantSlug,
  capabilities,
  billSyncToFiscal = false,
  showBackButton = true,
  onBack,
  onAllPaid,
  onCloseTableComplete,
}: Props) {
  const canForceCloseTable = mayForceCloseTable(capabilities);
  const canPrintFiscalInvoice =
    billSyncToFiscal && mayFiscalBillQueue(capabilities);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceScopeId, setInvoiceScopeId] = useState<string | undefined>(undefined);
  const [pathChoice, setPathChoice] = useState<StaffCheckoutPathChoice>('undecided');
  const { reload, getCollectedForSession, applyConfirmPaymentOutcome, updateRequests } =
    useCheckoutRequests();
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
  const {
    isResumeBusy,
    isResumeMutating,
    resumeOrdering,
  } = useCheckoutResumeOrdering({
    restaurantSlug,
    tableId: request.table_id,
    onMutated: onResumeMutated,
    showToast,
    messages: {
      failed: t.resumeOrderingFailed,
      blockedWholeTable: t.resumeOrderingBlockedWholeTable,
      success: t.resumeOrderingSuccess,
    },
  });
  const discountReasonOptionsList = useMemo(
    () => abnormalReasonOptions(lang, 'discount'),
    [lang],
  );
  const supabase = useMemo(() => createClient(), []);
  const [selectedLines, setSelectedLines] = useState<CheckoutDisplayLine[]>([]);
  const [sessionOrders, setSessionOrders] = useState<Order[]>([]);
  const [itemCodeByMenuId, setItemCodeByMenuId] = useState<Record<string, string>>({});
  const [resumeConfirmOpen, setResumeConfirmOpen] = useState(false);
  const {
    printCheckoutBill,
    printSplitReceipt,
    isPrintBillBusy,
    isPrintReceiptBusy,
    cooldownSecondsLeft,
    isOnCooldown,
  } = useStaffCheckoutBillPrint(restaurantSlug);

  useEffect(() => {
    if (!restaurantId || !request.session_id) {
      setSelectedLines([]);
      setSessionOrders([]);
      setItemCodeByMenuId({});
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
          return;
      }

      const orders = (orderRows || []) as Order[];
      const menuItemIds = distinctMenuItemIdsFromOrders(orders);
      let codes: Record<string, string> = {};
      if (menuItemIds.length > 0) {
        const { data: menuRows } = await supabase
          .from('menu_items')
          .select('id, item_code')
          .eq('restaurant_id', restaurantId)
          .in('id', menuItemIds);
        codes = menuItemCodeLookupFromRows(menuRows ?? []);
      }

      setSessionOrders(orders);
      setItemCodeByMenuId(codes);
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
          const message =
            outcome.error === 'reason_required'
              ? t.discountReasonRequired
              : outcome.error === 'reason_detail_required'
                ? t.discountReasonDetailRequired
                : outcome.error === 'discount_locked_after_payment'
                  ? t.discountLockedAfterPayment
                  : '操作失败，请重试';
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

  const handleDiscountRateBlur = (row: BillSplit) => {
    const rate = getDiscountRate(row);
    const serverRate = row.discount_rate ?? 0;
    const setup = billDiscount.beginSetupIfNeeded(
      row.id,
      rate,
      serverRate,
      row.discount_reason,
    );
    if (setup.needsReason) return;
    if (rate === serverRate) {
      billDiscount.finishSetup(row.id);
      return;
    }
    void persistDiscount(
      row,
      rate,
      row.discount_reason ?? undefined,
      row.discount_reason_detail ?? undefined,
    );
  };

  const splitModeLabels = useMemo(
    () => checkoutSplitModeUiLabels(lang, t.splitModeWhole),
    [lang, t.splitModeWhole],
  );

  const discountRate = getDiscountRate(request);
  const discountedRows = useMemo(
    () => discountedSplitRows(request, discountRate),
    [request, discountRate],
  );
  const settlementRows = useMemo(
    () => buildSplitSettlementRows(discountedRows, collectedPayments),
    [discountedRows, collectedPayments],
  );
  const summary = buildCheckoutSettlementSummary(request, discountRate, collectedPayments);
  const splitModeLabel = checkoutSplitModeLabel(request.split_mode, splitModeLabels);
  const pendingSettlementRows = useMemo(
    () => pendingSplitSettlementRows(settlementRows),
    [settlementRows],
  );

  const submitConfirmPersonPaid = async (row: BillSplit, rowIndex: number) => {
    const settlementRow = settlementRows.find((entry) => entry.index === rowIndex);
    if (!settlementRow || !isSplitSettlementPending(settlementRow)) {
      showToast(t.paid, 'error');
      return;
    }

    const collectedAmount = settlementRow.outstandingAmount;
    if (!restaurantSlug) {
      showToast('操作失败，请重试', 'error');
      return;
    }

    const personKey = checkoutPersonKey(row.id, rowIndex);
    setProcessingKeys((prev) => new Set(prev).add(personKey));
    try {
      const outcome = await requestCheckoutConfirmPayment({
        slug: restaurantSlug,
        billSplitId: row.id,
        personIndex: rowIndex,
        collectedAmount,
      });
      if (!outcome.ok) {
        showToast(outcome.error === 'already_paid' ? t.paid : '操作失败，请重试', 'error');
        return;
      }

      applyConfirmPaymentOutcome({
        billSplitId: row.id,
        sessionId: row.session_id,
        outcome: {
          all_paid: outcome.all_paid,
          result: outcome.result,
          final_amount: outcome.final_amount,
          collection: outcome.collection,
        },
      });
      syncBoardAfterMutation(row.table_id);
      if (outcome.all_paid) {
        onAllPaid?.();
      }
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
  const billCooldownKey = staffBillPrintCooldownKey(request.id);
  const printBillBusy = isPrintBillBusy(request.id);
  const {
    printFiscalInvoiceAvailable,
    printFiscalInvoiceBusy,
    printFiscalInvoice,
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

  const openInvoiceModal = useCallback((scopeId?: string) => {
    setInvoiceScopeId(scopeId);
    setInvoiceModalOpen(true);
  }, []);

  const openSplitInvoice = useCallback(
    (payment: SessionCollectedPayment) => {
      const name = payment.person_name?.trim();
      if (!name) return;
      openInvoiceModal(billSyncByItemScopeId(request.id, name));
    },
    [openInvoiceModal, request.id],
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
    printBillBusy ||
    printFiscalInvoiceBusy;

  return (
    <>
      {detailPhase === 'path_chooser' ? (
        <div className="mb-3 space-y-3">
          {showBackButton ? (
            <button
              type="button"
              onClick={onBack}
              className="text-sm font-semibold text-brand-text-muted hover:text-brand-text"
            >
              ← {t.backToList}
            </button>
          ) : null}
          <CheckoutPathChooser
            title={t.pathChooserTitle}
            wholeTableLabel={t.pathChooserWholeTable}
            splitLabel={t.pathChooserSplit}
            onWholeTable={() => setPathChoice('whole_table')}
            onSplit={() => setPathChoice('split')}
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
          collectedPayments={collectedPayments}
          onCancel={returnToPathChooser}
          onConfirmed={() => {
            returnToPathChooser();
            void reload();
            syncBoardAfterMutation(request.table_id);
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
        canForceCloseTable={canForceCloseTable}
        printBillBusy={printBillBusy}
        printCooldownSeconds={cooldownSecondsLeft(billCooldownKey)}
        printOnCooldown={isOnCooldown(billCooldownKey)}
        printInvoiceAvailable={printFiscalInvoiceAvailable}
        printInvoiceBusy={printFiscalInvoiceBusy}
        onPrintInvoice={() => openInvoiceModal(undefined)}
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
        lang={lang}
        t={t}
        onBack={onBack}
        onReturnToPathChooser={
          detailPhase === 'settle' && showReturnToPathChooser
            ? returnToPathChooser
            : undefined
        }
        onDiscountRateChange={(next) => billDiscount.handleRateChange(request.id, next)}
        onDiscountRateFocus={() =>
          billDiscount.handleRateFocus(request.id, request.discount_rate ?? 0)
        }
        onDiscountRateBlur={() => handleDiscountRateBlur(request)}
        onConfirmPersonPaid={(index) => void submitConfirmPersonPaid(request, index)}
        onPrintBill={() => printCheckoutBill(request, getDiscountRate(request))}
        onResumeOrderingClick={() => setResumeConfirmOpen(true)}
        onCloseTable={() => {
          syncBoardAfterMutation(request.table_id);
          onCloseTableComplete?.();
          void reload();
        }}
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
      <PrintFiscalInvoiceModal
        open={invoiceModalOpen}
        busy={printFiscalInvoiceBusy}
        labels={{
          title: t.printInvoiceModalTitle,
          nif: t.printInvoiceNif,
          nifOptional: t.printInvoiceOptional,
          name: t.printInvoiceName,
          nameOptional: t.printInvoiceOptional,
          paymentMethod: t.printInvoicePaymentMethod,
          documentTypeHint: t.printInvoiceDocumentTypeHint,
          confirm: t.printInvoice,
          cancel: t.printInvoiceCancel,
          operating: t.printInvoiceOperating,
        }}
        paymentLabels={{
          CASH: t.paymentMethodCash,
          CARD: t.paymentMethodCard,
          MBWAY: t.paymentMethodMbway,
          MULTIBANCO: t.paymentMethodMultibanco,
          MIXED: t.paymentMethodMixed,
          OTHER: t.paymentMethodOther,
        }}
        onClose={() => {
          if (printFiscalInvoiceBusy) return;
          setInvoiceModalOpen(false);
        }}
        onConfirm={(input) => {
          void printFiscalInvoice({
            paymentMethod: input.paymentMethod,
            customerNif: input.customerNif,
            customerName: input.customerName,
            issueScopeId: invoiceScopeId,
          }).finally(() => setInvoiceModalOpen(false));
        }}
      />
    </>
  );
}
