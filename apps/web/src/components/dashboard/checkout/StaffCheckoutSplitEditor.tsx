'use client';

import { useCallback, useMemo, useState } from 'react';
import { BillSplitPanel } from '@/components/menu/BillSplitPanel';
import { CheckoutPathChooserBackButton } from '@/components/dashboard/checkout/checkout-detail-phase';
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
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { useBillSplitDraft } from '@/lib/use-bill-split-draft';
import type { BillSplit, Order } from '@/types';

type Props = {
  restaurantId: string;
  restaurantSlug: string;
  request: BillSplit;
  sessionOrders: Order[];
  itemCodeByMenuId: Record<string, string>;
  collectedPayments: SessionCollectedPayment[];
  onCancel: () => void;
  onConfirmed: () => void;
};

/**
 * Sole staff checkout split editor — same draft + BillSplitPanel as guest BillPage.
 * Confirm writes bill_splits via staff checkout/request (even | by_item | custom).
 */
export function StaffCheckoutSplitEditor({
  restaurantId,
  restaurantSlug,
  request,
  sessionOrders,
  itemCodeByMenuId,
  collectedPayments,
  onCancel,
  onConfirmed,
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

  const splitValidationMessage = useMemo(() => {
    if (!splitDraft.splitMode || splitDraft.splitValidation.ok) return null;
    const issue = splitDraft.splitValidation.issue;
    if (issue === 'unassigned_items') return billT.splitUnassignedItems;
    if (issue === 'incomplete_qty') return billT.splitIncompleteQty;
    return billT.splitAmountMismatch;
  }, [billT, splitDraft.splitMode, splitDraft.splitValidation]);

  const handleConfirm = useCallback(async () => {
    if (submitting) return;
    if (!splitDraft.splitMode) {
      showToast(billT.splitUnassignedItems, 'error');
      return;
    }
    setSubmitting(true);
    try {
      const draftInput =
        splitDraft.resolveSplitDraftInputForSubmit?.() ?? splitDraft.splitDraftInput;
      const validated = validateSubmitSplitDraft(draftInput, sessionOrders);
      if (!validated.ok) {
        const msg =
          validated.issue === 'unassigned_items'
            ? billT.splitUnassignedItems
            : validated.issue === 'incomplete_qty'
              ? billT.splitIncompleteQty
              : billT.splitAmountMismatch;
        showToast(msg, 'error');
        return;
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
      });
      if (!outcome.ok) {
        showToast(
          outcome.error === 'split_mode_locked' || outcome.error === 'locked_allocation_changed'
            ? billT.splitPlanLocked
            : checkoutT.callCheckoutFailed,
          'error',
        );
        return;
      }
      onConfirmed();
    } finally {
      setSubmitting(false);
    }
  }, [
    billT,
    checkoutT.callCheckoutFailed,
    onConfirmed,
    request.table_id,
    restaurantSlug,
    sessionOrders,
    splitDraft,
    submitting,
  ]);

  const confirmDisabled =
    submitting ||
    !splitDraft.splitMode ||
    !splitDraft.splitValidation.ok ||
    sessionOrders.length === 0;

  return (
    <div className="mb-3 rounded-lg border border-brand-border bg-brand-card px-2 py-3 space-y-3">
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
      />
      <div className="flex flex-wrap gap-2 px-2">
        <CheckoutPathChooserBackButton
          label={checkoutT.pathChooserBack}
          onClick={onCancel}
          disabled={submitting}
        />
        <button
          type="button"
          disabled={confirmDisabled}
          onClick={() => void handleConfirm()}
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-gold text-white disabled:opacity-50"
        >
          {submitting ? checkoutT.callCheckoutOperating : checkoutT.splitEditConfirm}
        </button>
      </div>
    </div>
  );
}
