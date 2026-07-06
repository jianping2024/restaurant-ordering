'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { BillSplit, Order } from '@/types';
import { showToast } from '@/components/ui/Toast';
import { ReasonConfirmDialog } from '@/components/ui/ReasonConfirmDialog';
import {
  checkoutPersonKey,
  checkoutResumeOrderingKey,
} from '@/lib/checkout-request-state';
import { discountedSplitRows } from '@/lib/checkout-split-math';
import {
  hasConfirmedPerson,
  parseSessionCollectedPayments,
  SESSION_COLLECTED_PAYMENT_SELECT,
  type SessionCollectedPayment,
  resumeCheckoutBlockReason,
  resumeOrderingConfirmVariant,
  collectibleSplitRowsWithIndex,
  isSplitRowCollectible,
  suggestedCollectionAmount,
  sumCollectedByPersonIndex,
} from '@/lib/checkout-session-payments';
import { requestCheckoutResumeOrdering } from '@/lib/request-checkout-resume-ordering';
import { useStaffCheckoutBillPrint } from '@/lib/use-staff-checkout-bill-print';
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

type Props = {
  request: BillSplit;
  restaurantId: string;
  restaurantSlug: string;
  canCloseTable?: boolean;
  showBackButton?: boolean;
  onBack: () => void;
  /** Called after the queue row is removed because everyone paid. */
  onAllPaid?: () => void;
  onCloseTableComplete?: () => void;
  onResumeOrderingComplete?: () => void;
};

export function CheckoutRequestDetailHost({
  request,
  restaurantId,
  restaurantSlug,
  canCloseTable = false,
  showBackButton = true,
  onBack,
  onAllPaid,
  onCloseTableComplete,
  onResumeOrderingComplete,
}: Props) {
  const { updateRequests, reload } = useCheckoutRequests();
  const waiterBoard = useWaiterBoardOptional();
  const syncBoardAfterMutation = useCallback(
    (tableId: string) => {
      void waiterBoard?.refreshAfterTableMutation(tableId);
    },
    [waiterBoard],
  );
  const [processingKeys, setProcessingKeys] = useState<Set<string>>(() => new Set());
  const billDiscount = useCheckoutBillDiscount();
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const discountReasonOptionsList = useMemo(
    () => abnormalReasonOptions(lang, 'discount'),
    [lang],
  );
  const supabase = useMemo(() => createClient(), []);
  const [selectedLines, setSelectedLines] = useState<CheckoutDisplayLine[]>([]);
  const [collectedPayments, setCollectedPayments] = useState<SessionCollectedPayment[]>([]);
  const [resumeConfirmOpen, setResumeConfirmOpen] = useState(false);
  const {
    printCheckoutBill,
    isPrintBillBusy,
    cooldownSecondsLeft,
    isOnCooldown,
  } = useStaffCheckoutBillPrint(restaurantSlug);

  useEffect(() => {
    if (!restaurantId || !request.session_id) {
      setSelectedLines([]);
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
        return;
      }

      const menuItemIds = distinctMenuItemIdsFromOrders((orderRows || []) as Order[]);
      let itemCodeByMenuId: Record<string, string> = {};
      if (menuItemIds.length > 0) {
        const { data: menuRows } = await supabase
          .from('menu_items')
          .select('id, item_code')
          .eq('restaurant_id', restaurantId)
          .in('id', menuItemIds);
        itemCodeByMenuId = menuItemCodeLookupFromRows(menuRows ?? []);
      }

      setSelectedLines(checkoutLinesFromOrders((orderRows || []) as Order[], itemCodeByMenuId));
    };

    void loadLines();
    return () => {
      cancelled = true;
    };
  }, [supabase, restaurantId, request.session_id]);

  useEffect(() => {
    if (!restaurantId || !request.session_id) {
      setCollectedPayments([]);
      return;
    }

    let cancelled = false;
    const loadCollected = async () => {
      const { data, error } = await supabase
        .from('session_collected_payments')
        .select(SESSION_COLLECTED_PAYMENT_SELECT)
        .eq('restaurant_id', restaurantId)
        .eq('session_id', request.session_id)
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (error) {
        setCollectedPayments([]);
        return;
      }
      setCollectedPayments(parseSessionCollectedPayments(data));
    };

    void loadCollected();
    return () => {
      cancelled = true;
    };
  }, [supabase, restaurantId, request.session_id]);

  const getDiscountRate = (row: BillSplit) =>
    billDiscount.getDisplayRate(row.id, row.discount_rate ?? 0);
  const getDiscountedSplitResult = (row: BillSplit) =>
    discountedSplitRows(row, getDiscountRate(row));

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

  const submitConfirmPersonPaid = async (row: BillSplit, rowIndex: number) => {
    const discountedRows = getDiscountedSplitResult(row);
    const splitRow = discountedRows[rowIndex];
    if (!splitRow) return;

    const collectedByIndex = sumCollectedByPersonIndex(collectedPayments);
    const collectedAmount = suggestedCollectionAmount(
      rowIndex,
      splitRow.amount,
      collectedByIndex,
    );
    if (!isSplitRowCollectible(splitRow.amount, collectedByIndex, rowIndex)) {
      showToast(t.paid, 'error');
      return;
    }
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

      if (row.session_id) {
        const { data } = await supabase
          .from('session_collected_payments')
          .select(SESSION_COLLECTED_PAYMENT_SELECT)
          .eq('restaurant_id', restaurantId)
          .eq('session_id', row.session_id)
          .order('created_at', { ascending: true });
        setCollectedPayments(parseSessionCollectedPayments(data));
      }

      updateRequests((prev) =>
        outcome.all_paid
          ? prev.filter((r) => r.id !== row.id)
          : prev.map((r) => (r.id === row.id ? { ...r, result: outcome.result } : r)),
      );
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

  const handleResumeOrdering = async (row: BillSplit) => {
    if (!restaurantSlug) {
      showToast(t.resumeOrderingFailed, 'error');
      return;
    }

    const resumeKey = checkoutResumeOrderingKey(row.id);
    setProcessingKeys((prev) => new Set(prev).add(resumeKey));
    try {
      const outcome = await requestCheckoutResumeOrdering({
        slug: restaurantSlug,
        tableId: row.table_id,
      });
      if (!outcome.ok) {
        const message =
          outcome.error === 'whole_table_paid'
            ? t.resumeOrderingBlockedWholeTable
            : t.resumeOrderingFailed;
        showToast(message, 'error');
        return;
      }

      void reload();
      syncBoardAfterMutation(row.table_id);
      onResumeOrderingComplete?.();
      showToast(t.resumeOrderingSuccess, 'success');
    } catch {
      showToast(t.resumeOrderingFailed, 'error');
    } finally {
      setProcessingKeys((prev) => {
        const next = new Set(prev);
        next.delete(resumeKey);
        return next;
      });
      setResumeConfirmOpen(false);
    }
  };

  const splitModeLabels = useMemo(
    () => ({
      even: t.splitModeEven,
      byItem: t.splitModeByItem,
      custom: t.splitModeCustom,
      wholeTable: t.splitModeWhole,
    }),
    [t],
  );

  const discountRate = getDiscountRate(request);
  const summary = buildCheckoutSettlementSummary(request, discountRate, collectedPayments);
  const splitModeLabel = checkoutSplitModeLabel(request.split_mode, splitModeLabels);
  const collectedByIndex = useMemo(
    () => sumCollectedByPersonIndex(collectedPayments),
    [collectedPayments],
  );
  const resumeBlockReason = resumeCheckoutBlockReason(request, collectedPayments);
  const resumeConfirmMessage = useMemo(() => {
    const variant = resumeOrderingConfirmVariant(request, collectedPayments);
    if (variant === 'preserve_by_item') return t.resumeOrderingConfirmPreserveByItem;
    if (variant === 'preserve_with_collections') return t.resumeOrderingConfirmPreserveWithCollections;
    return t.resumeOrderingConfirmCancel;
  }, [request, collectedPayments, t]);
  const pendingSplitRows = collectibleSplitRowsWithIndex(
    getDiscountedSplitResult(request),
    collectedByIndex,
  );
  const partialPaid = hasCheckoutCollections(request, collectedPayments);

  return (
    <>
      <CheckoutRequestDetail
        request={request}
        summary={summary}
        splitModeLabel={splitModeLabel}
        partialPaid={partialPaid}
        collectedPayments={collectedPayments}
        pendingSplitRows={pendingSplitRows}
        collectedByIndex={collectedByIndex}
        selectedLines={selectedLines}
        processingKeys={processingKeys}
        discountRate={discountRate}
        discountApplying={billDiscount.applyingRequestId === request.id}
        discountLocked={hasConfirmedPerson(request)}
        resumeBlockReason={resumeBlockReason}
        canCloseTable={canCloseTable}
        printBillBusy={isPrintBillBusy(request.id)}
        printCooldownSeconds={cooldownSecondsLeft(request.id)}
        printOnCooldown={isOnCooldown(request.id)}
        showBackButton={showBackButton}
        lang={lang}
        t={t}
        onBack={onBack}
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
        onClose={() => setResumeConfirmOpen(false)}
        title={t.resumeOrderingConfirmTitle}
        message={resumeConfirmMessage}
        confirmLabel={t.resumeOrdering}
        cancelLabel={t.resumeOrderingCancel}
        confirming={processingKeys.has(checkoutResumeOrderingKey(request.id))}
        onConfirm={() => void handleResumeOrdering(request)}
      />
    </>
  );
}
