'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BillSplitPanel } from '@/components/menu/BillSplitPanel';
import {
  CheckoutPathChooserBackButton,
} from '@/components/dashboard/checkout/checkout-detail-phase';
import {
  CheckoutSessionActions,
  SettlementBar,
} from '@/components/dashboard/checkout/CheckoutRequestDetail';
import { StaffByItemSplitWorkbench } from '@/components/dashboard/checkout/StaffByItemSplitWorkbench';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { showToast } from '@/components/ui/Toast';
import {
  buildSubmitPersons,
  validateSubmitSplitDraft,
} from '@/lib/checkout-request-submit';
import { deriveBillView } from '@/lib/customer-bill-sync';
import { getGuestSplitGuidance } from '@/lib/i18n/guest-split-mode-messages';
import { getMessages } from '@/lib/i18n/messages';
import { requestCheckoutRequest } from '@/lib/request-checkout-request';
import { messageForCheckoutRequestError } from '@/lib/checkout-request-error-message';
import { discountedObligationAmount } from '@/lib/checkout-split-math';
import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { locateByItemSplitResult } from '@/lib/bill-split-by-item';
import { useBillSplitDraft } from '@/lib/use-bill-split-draft';
import type { BillSplit, Order, SplitResult } from '@/types';

type Props = {
  restaurantId: string;
  restaurantSlug: string;
  request: BillSplit;
  sessionOrders: Order[];
  itemCodeByMenuId: Record<string, string>;
  /** Catalog photo urls for by-item pool thumbs (menu_item.id → image_url). */
  imageUrlByMenuId?: Record<string, string>;
  collectedPayments: SessionCollectedPayment[];
  summary: CheckoutSettlementSummary;
  discountRate: number;
  discountApplying: boolean;
  discountLocked: boolean;
  detailLocked: boolean;
  resumeOperating: boolean;
  resumeBlockReason: string | null;
  showPathBack: boolean;
  onCancel: () => void;
  onDiscountRateChange: (rate: number) => void;
  onDiscountRateFocus: () => void;
  onDiscountRateBlur: () => void;
  onResumeOrderingClick: () => void;
  onCollectPerson: (index: number, amount: number) => void;
  onSplitPersisted: (row: BillSplit) => void;
  onRegisterPersist: (persist: (() => Promise<boolean>) | null) => void;
};

/**
 * Sole staff checkout split editor.
 * Draft + even/custom chrome shared with guest BillSplitPanel;
 * by_item layout is sole StaffByItemSplitWorkbench (not guest dish cards).
 */
export function StaffCheckoutSplitEditor({
  restaurantId,
  restaurantSlug,
  request,
  sessionOrders,
  itemCodeByMenuId,
  imageUrlByMenuId = {},
  collectedPayments,
  summary,
  discountRate,
  discountApplying,
  discountLocked,
  detailLocked,
  resumeOperating,
  resumeBlockReason,
  showPathBack,
  onCancel,
  onDiscountRateChange,
  onDiscountRateFocus,
  onDiscountRateBlur,
  onResumeOrderingClick,
  onCollectPerson,
  onSplitPersisted,
  onRegisterPersist,
}: Props) {
  const { lang } = useLanguage();
  const billT = getMessages(lang).bill;
  const checkoutT = getMessages(lang).checkout;
  const guestName = useCallback((n: number) => `${billT.guest} ${n}`, [billT.guest]);

  const { splitOrderLines, lineSpecs, total } = useMemo(
    () => deriveBillView(sessionOrders),
    [sessionOrders],
  );

  const [submitting, setSubmitting] = useState(false);

  const splitDraft = useBillSplitDraft({
    restaurantId,
    sessionId: request.session_id ?? null,
    existingSplit: request,
    continuationSplit: request,
    collectedPayments,
    total,
    orderLines: splitOrderLines,
    lineSpecs,
    lang,
    guestName,
    submitted: false,
    persistedResult: null,
    submitting,
  });

  const byItemAllocatorLabels = useMemo(
    () => ({
      addConsumer: billT.addConsumer,
      namePlaceholder: billT.consumerNamePlaceholder,
      wholeLabel: billT.qtyWholePlaceholder,
      numLabel: billT.qtyNumPlaceholder,
      denLabel: billT.qtyDenPlaceholder,
      missingDen: billT.qtyMissingDen,
      zeroDen: billT.qtyZeroDen,
      improperFraction: billT.qtyImproperFraction,
      complete: billT.byItemComplete,
      remaining: billT.byItemRemaining,
      over: billT.byItemOver,
      missingNames: billT.byItemMissingNames,
      duplicateNames: billT.byItemDuplicateNames,
      unassigned: billT.byItemUnassigned,
      invalidQty: billT.byItemInvalidQty,
      buffetComplete: billT.byItemBuffetComplete,
      buffetShortAdult: billT.byItemBuffetShortAdult,
      buffetShortChild: billT.byItemBuffetShortChild,
      buffetOverAdult: billT.byItemBuffetOverAdult,
      buffetOverChild: billT.byItemBuffetOverChild,
      buffetAdultProgress: billT.byItemBuffetAdultProgress,
      buffetChildProgress: billT.byItemBuffetChildProgress,
      buffetAdultQtyLabel: billT.byItemGuestTypeAdult,
      buffetChildQtyLabel: billT.byItemGuestTypeChild,
      remove: billT.removeConsumer,
      expandDetails: billT.byItemExpandDetails,
      collapseDetails: billT.byItemCollapseDetails,
      byItemProgress: billT.byItemProgress,
    }),
    [billT],
  );

  const staffByItemLabels = useMemo(
    () => ({
      poolTitle: checkoutT.staffByItemPool,
      currentShareTitle: checkoutT.staffByItemCurrentShare,
      markerName: checkoutT.staffByItemMarkerName,
      markerHint: checkoutT.staffByItemMarkerHint,
      markerPlaceholder: billT.consumerNamePlaceholder,
      remainingPrefix: checkoutT.staffByItemRemaining,
      dueTotal: (amount: string) =>
        checkoutT.staffByItemDueTotal.replace('{amount}', amount),
      estimate: (n: number, amount: string) =>
        checkoutT.staffByItemEstimate
          .replace('{n}', String(n))
          .replace('{amount}', amount),
      needName: checkoutT.staffByItemNeedName,
      poolEmpty: checkoutT.staffByItemPoolEmpty,
      progress: billT.byItemProgress,
      addAdult: billT.byItemGuestTypeAdult,
      addChild: billT.byItemGuestTypeChild,
      remove: checkoutT.returnShareToPool,
      collect: checkoutT.collectPerson,
      paidLocked: billT.splitPlanLocked,
      qtyParts: {
        wholeLabel: billT.qtyWholePlaceholder,
        numLabel: billT.qtyNumPlaceholder,
        denLabel: billT.qtyDenPlaceholder,
        missingDen: billT.qtyMissingDen,
        zeroDen: billT.qtyZeroDen,
        improperFraction: billT.qtyImproperFraction,
      },
    }),
    [billT, checkoutT],
  );

  const splitValidationMessage = useMemo(() => {
    if (!splitDraft.splitMode || splitDraft.splitValidation.ok) return null;
    const issue = splitDraft.splitValidation.issue;
    if (
      splitDraft.splitMode === 'by_item' &&
      (issue === 'unassigned_items' || issue === 'incomplete_qty')
    ) {
      return null;
    }
    if (issue === 'unassigned_items') return billT.splitUnassignedItems;
    if (issue === 'incomplete_qty') return billT.splitIncompleteQty;
    return billT.splitAmountMismatch;
  }, [billT, splitDraft.splitMode, splitDraft.splitValidation]);

  const persistSplit = useCallback(async (): Promise<SplitResult[] | null> => {
    if (!splitDraft.splitMode) {
      showToast(billT.splitUnassignedItems, 'error');
      return null;
    }
    const draftInput =
      splitDraft.resolveSplitDraftInputForSubmit?.() ?? splitDraft.splitDraftInput;
    const allowPartialByItem = splitDraft.splitMode === 'by_item';
    const validated = validateSubmitSplitDraft(draftInput, sessionOrders, { allowPartialByItem });
    if (!validated.ok) {
      const msg =
        validated.issue === 'unassigned_items'
          ? billT.splitUnassignedItems
          : validated.issue === 'incomplete_qty'
            ? billT.splitIncompleteQty
            : billT.splitAmountMismatch;
      showToast(msg, 'error');
      return null;
    }
    const persons = buildSubmitPersons({
      splitMode: splitDraft.splitMode,
      submitResults: validated.submitResults,
      splitPeople: splitDraft.splitPeople,
      buildPersonsForSubmit: splitDraft.buildPersonsForSubmit,
    });
    const outcome = await requestCheckoutRequest({
      slug: restaurantSlug,
      tableId: request.table_id,
      splitMode: splitDraft.splitMode,
      persons,
      result: validated.submitResults,
      allowPartialByItem,
    });
    if (!outcome.ok) {
      showToast(
        messageForCheckoutRequestError(outcome.error, {
          guestCountRequired: checkoutT.callCheckoutGuestCountRequired,
          partyMergeRequired: checkoutT.callCheckoutPartyMergeRequired,
          emptySession: checkoutT.callCheckoutEmptySession,
          noActiveSession: checkoutT.callCheckoutNoActiveSession,
          tableNotAvailable: checkoutT.callCheckoutTableNotAvailable,
          invalidNif: billT.nifInvalid,
          splitPlanLocked: billT.splitPlanLocked,
          fallback: checkoutT.callCheckoutFailed,
        }),
        'error',
      );
      return null;
    }
    onSplitPersisted({
      ...request,
      id: outcome.bill_split_id,
      split_mode: splitDraft.splitMode,
      persons,
      result: outcome.result,
      status: 'requested',
    });
    return outcome.result;
  }, [
    billT,
    checkoutT,
    onSplitPersisted,
    request,
    restaurantSlug,
    sessionOrders,
    splitDraft,
  ]);

  useEffect(() => {
    onRegisterPersist(async () => {
      setSubmitting(true);
      try {
        const saved = await persistSplit();
        return saved != null;
      } finally {
        setSubmitting(false);
      }
    });
    return () => onRegisterPersist(null);
  }, [onRegisterPersist, persistSplit]);

  const collectSavedPerson = useCallback(
    async (index: number, preDiscountAmount: number) => {
      const amount = discountedObligationAmount(preDiscountAmount, discountRate);
      if (amount <= 0) {
        showToast(checkoutT.cashShort, 'error');
        return;
      }
      onCollectPerson(index, amount);
    },
    [checkoutT.cashShort, discountRate, onCollectPerson],
  );

  return (
    <div className="mb-3 rounded-lg border border-brand-border bg-brand-card px-2 py-3 space-y-3">
      <SettlementBar
        summary={summary}
        discountRate={discountRate}
        discountApplying={discountApplying}
        discountLocked={discountLocked}
        detailLocked={detailLocked || submitting}
        t={checkoutT}
        onDiscountRateChange={onDiscountRateChange}
        onDiscountRateFocus={onDiscountRateFocus}
        onDiscountRateBlur={onDiscountRateBlur}
      />
      <BillSplitPanel
        lang={lang}
        copy={{
          splitMode: billT.splitMode,
          splitPlanLocked: billT.splitPlanLocked,
          people: billT.people,
          splitResult: billT.splitResult,
          addPerson: billT.addPerson,
          splitPaid: billT.splitPaid,
          splitPartialPaid: billT.splitPartialPaid,
          splitAmountBreakdown: billT.splitAmountBreakdown,
        }}
        splitGuidance={getGuestSplitGuidance(lang)}
        splitMode={splitDraft.splitMode}
        splitLocked={splitDraft.splitLocked}
        submitting={submitting}
        personCount={splitDraft.personCount}
        splitPeople={splitDraft.splitPeople}
        customAmounts={splitDraft.customAmounts}
        results={splitDraft.results}
        splitDisplayRows={splitDraft.splitDisplayRows}
        lockedPersonNames={splitDraft.lockedPersonNames}
        lockedPersonLineMins={splitDraft.lockedPersonLineMins}
        lineSpecs={lineSpecs}
        orderLines={splitOrderLines}
        byItemAllocations={splitDraft.byItemAllocations}
        consumerRoster={splitDraft.consumerRoster}
        byItemProgress={splitDraft.byItemProgress}
        byItemAllocatorLabels={byItemAllocatorLabels}
        itemCodeByMenuId={itemCodeByMenuId}
        splitValidationMessage={splitValidationMessage}
        guestName={guestName}
        editingSplitNameIndex={splitDraft.editingSplitNameIndex}
        editingSplitNameValue={splitDraft.editingSplitNameValue}
        editingCustomAmountIndex={splitDraft.editingCustomAmountIndex}
        editingCustomAmountValue={splitDraft.editingCustomAmountValue}
        onSplitModeClick={splitDraft.handleSplitModeClick}
        onDecrementPersonCount={splitDraft.decrementPersonCount}
        onIncrementPersonCount={splitDraft.incrementPersonCount}
        onAllocationChange={(key, rows) => {
          splitDraft.setByItemAllocations((prev) => ({ ...prev, [key]: rows }));
        }}
        onRememberConsumerName={splitDraft.rememberConsumerName}
        onStartInlineRename={splitDraft.startInlineRename}
        onCommitInlineRename={splitDraft.commitInlineRename}
        onEditingSplitNameValueChange={splitDraft.setEditingSplitNameValue}
        onCancelInlineRename={() => {
          splitDraft.setEditingSplitNameIndex(null);
          splitDraft.setEditingSplitNameValue('');
        }}
        onStartInlineAmountEdit={splitDraft.startInlineAmountEdit}
        onCommitInlineAmountEdit={splitDraft.commitInlineAmountEdit}
        onEditingCustomAmountValueChange={splitDraft.setEditingCustomAmountValue}
        onCancelInlineAmountEdit={() => {
          splitDraft.setEditingCustomAmountIndex(null);
          splitDraft.setEditingCustomAmountValue('');
        }}
        onAddCustomPerson={splitDraft.addCustomPerson}
        staffRowActions={
          splitDraft.splitMode === 'even' || splitDraft.splitMode === 'custom'
            ? {
                collectLabel: checkoutT.collectPerson,
                removeLabel: checkoutT.returnShareToPool,
                busy: submitting || detailLocked,
                onCollect: (index) => {
                  const row = splitDraft.results[index];
                  if (!row) return;
                  void collectSavedPerson(index, row.amount);
                },
                onRemoveCustom: splitDraft.removeCustomPerson,
              }
            : undefined
        }
        byItemContent={(
          <StaffByItemSplitWorkbench
            lang={lang}
            lineSpecs={lineSpecs}
            orderLines={splitOrderLines}
            byItemAllocations={splitDraft.byItemAllocations}
            lockedPersonNames={splitDraft.lockedPersonNames}
            lockedPersonLineMins={splitDraft.lockedPersonLineMins}
            itemCodeByMenuId={itemCodeByMenuId}
            imageUrlByMenuId={imageUrlByMenuId}
            guestName={guestName}
            labels={staffByItemLabels}
            progress={splitDraft.byItemProgress}
            disabled={submitting || detailLocked}
            onAllocationChange={(next) => splitDraft.setByItemAllocations(next)}
            onRenamePerson={splitDraft.renameByItemConsumer}
            onCollectCurrent={(personName) => {
              const trimmed = personName.trim();
              if (!trimmed) {
                showToast(checkoutT.staffByItemNeedName, 'error');
                return;
              }
              const located = locateByItemSplitResult(splitDraft.results, trimmed);
              if (!located || located.row.amount <= 0) {
                showToast(checkoutT.staffByItemNoCollectableShare, 'error');
                return;
              }
              void collectSavedPerson(located.index, located.row.amount);
            }}
          />
        )}
      />
      <CheckoutSessionActions
        t={checkoutT}
        detailLocked={detailLocked || submitting}
        resumeOperating={resumeOperating}
        resumeBlockReason={resumeBlockReason}
        onResumeOrderingClick={onResumeOrderingClick}
        leading={
          showPathBack ? (
            <CheckoutPathChooserBackButton
              label={checkoutT.pathChooserBack}
              onClick={onCancel}
              disabled={submitting || detailLocked}
            />
          ) : null
        }
      />
    </div>
  );
}
