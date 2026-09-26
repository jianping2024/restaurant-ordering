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
  buildByItemAllocationsFromRows,
  buildSplitPersonsFromAllocations,
  calcByItemSplitResults,
  stampCollectTicketFrozenAmounts,
} from '@/lib/bill-split-by-item';
import { byItemSplitLineFromOrderLine } from '@/lib/bill-split-by-item-lines';
import {
  applyCollectedObligationFloors,
  byItemPoolFullyAllocated,
  collectModalAmountStillValid,
  mergeCurrentByItemTicketForCollect,
  resolveByItemCollectTarget,
  resolveStaffByItemEditRoster,
  settledByItemPersonKeys,
} from '@/lib/checkout-by-item-collect';
import {
  staffByItemLedgerPeople,
  type StaffByItemRailPerson,
} from '@/lib/staff-by-item-people';
import { staffByItemPeopleFromAllocations } from '@/lib/staff-by-item-workbench';
import { splitPartyKey, splitResultTicketKey, toWireSplitResult } from '@/lib/split-party-id';
import { allocationLockedTicketKeys } from '@/lib/checkout-split-continuation';
import {
  buildSubmitPersons,
  validateSubmitSplitDraft,
} from '@/lib/checkout-request-submit';
import { deriveBillView } from '@/lib/customer-bill-sync';
import { getGuestSplitGuidance } from '@/lib/i18n/guest-split-mode-messages';
import { getMessages } from '@/lib/i18n/messages';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { requestCheckoutRequest } from '@/lib/request-checkout-request';
import { messageForCheckoutRequestError } from '@/lib/checkout-request-error-message';
import { discountedObligationAmount } from '@/lib/checkout-split-math';
import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
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
  /** Mobile back to queue — rendered inside sticky SettlementBar chrome. */
  showBackButton?: boolean;
  onBack?: () => void;
  /** Sticky shell for SettlementBar — default under staff top bar; board sheet overrides. */
  stickyShellClass?: string;
  onDiscountRateChange: (rate: number) => void;
  onDiscountRateFocus: () => void;
  onDiscountRateBlur: () => void;
  onResumeOrderingClick: () => void;
  onCollectPerson: (
    index: number,
    amount: number,
    personName?: string,
    partyId?: string,
  ) => void;
  onSplitPersisted: (row: BillSplit) => void;
  /**
   * Even/custom only: full split persist before collect.
   * By-item must use {@link onRegisterCollectTicket} (never whole-table recalc).
   */
  onRegisterPersist: (persist: (() => Promise<SplitResult[] | null>) | null) => void;
  /** Sole by-item collect confirm: upsert current ticket only; modal amount stays authoritative. */
  onRegisterCollectTicket: (
    persist: ((args: {
      personName: string;
      partyId?: string;
      modalAmount: number;
    }) => Promise<{ personIndex: number } | null>) | null,
  ) => void;
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
  showBackButton = false,
  onBack,
  stickyShellClass,
  onDiscountRateChange,
  onDiscountRateFocus,
  onDiscountRateBlur,
  onResumeOrderingClick,
  onCollectPerson,
  onSplitPersisted,
  onRegisterPersist,
  onRegisterCollectTicket,
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
      shareEmpty: checkoutT.staffByItemShareEmpty,
      estimate: (n: number, amount: string) =>
        checkoutT.staffByItemEstimate
          .replace('{n}', String(n))
          .replace('{amount}', amount),
      needName: checkoutT.staffByItemNeedName,
      poolEmpty: checkoutT.staffByItemPoolEmpty,
      addAdult: billT.byItemGuestTypeAdult,
      addChild: billT.byItemGuestTypeChild,
      remove: checkoutT.returnShareToPool,
      collect: checkoutT.collectPerson,
      paidLocked: billT.splitPlanLocked,
      paidShareBadge: checkoutT.staffByItemPaidShare,
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

  const ledgerPeople = useMemo((): StaffByItemRailPerson[] => {
    return staffByItemLedgerPeople(
      (request.result ?? []).map((row) => ({
        name: row.name,
        ...(row.party_id?.trim() ? { partyId: row.party_id.trim() } : {}),
      })),
    );
  }, [request.result]);

  const liveByItemResults = useMemo(() => {
    if (splitDraft.splitMode !== 'by_item') return [] as SplitResult[];
    const allocations = buildByItemAllocationsFromRows(
      lineSpecs,
      splitDraft.byItemAllocations,
    );
    const lines = splitOrderLines.map((item) =>
      byItemSplitLineFromOrderLine(item, resolveMenuItemLocalizedName(item, lang)),
    );
    const orderPeople =
      ledgerPeople.length > 0
        ? ledgerPeople
        : staffByItemPeopleFromAllocations(splitDraft.byItemAllocations);
    const calc = calcByItemSplitResults({
      lines,
      allocations,
      personOrder: orderPeople.map((p) => p.name),
      personPartyIds: orderPeople.map((p) => p.partyId),
    });
    return calc.map((row) => toWireSplitResult(row));
  }, [
    lang,
    ledgerPeople,
    lineSpecs,
    splitDraft.byItemAllocations,
    splitDraft.splitMode,
    splitOrderLines,
  ]);

  const editRoster = useMemo(
    () =>
      resolveStaffByItemEditRoster({
        ledgerResults: (request.result ?? []) as SplitResult[],
        liveResults: liveByItemResults,
      }),
    [liveByItemResults, request.result],
  );

  const settledTicketKeys = useMemo(
    () => settledByItemPersonKeys(editRoster, collectedPayments),
    [collectedPayments, editRoster],
  );

  const lockedTicketKeys = useMemo(() => {
    const keys = new Set(allocationLockedTicketKeys(request, collectedPayments));
    for (const key of settledTicketKeys) keys.add(key);
    return keys;
  }, [collectedPayments, request, settledTicketKeys]);

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
    const allocations =
      splitDraft.splitMode === 'by_item'
        ? buildByItemAllocationsFromRows(lineSpecs, splitDraft.byItemAllocations)
        : undefined;
    const poolComplete =
      splitDraft.splitMode === 'by_item' &&
      allocations != null &&
      byItemPoolFullyAllocated(lineSpecs, allocations);
    const allowPartialByItem = splitDraft.splitMode === 'by_item' && !poolComplete;
    const validated = validateSubmitSplitDraft(draftInput, sessionOrders, {
      allowPartialByItem,
    });
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
    const resultPayload =
      splitDraft.splitMode === 'by_item'
        ? applyCollectedObligationFloors(validated.submitResults, collectedPayments)
        : validated.submitResults;
    const persons = buildSubmitPersons({
      splitMode: splitDraft.splitMode,
      submitResults: resultPayload,
      splitPeople: splitDraft.splitPeople,
      buildPersonsForSubmit: splitDraft.buildPersonsForSubmit,
    });
    const outcome = await requestCheckoutRequest({
      slug: restaurantSlug,
      tableId: request.table_id,
      splitMode: splitDraft.splitMode,
      persons,
      result: resultPayload,
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
    collectedPayments,
    lineSpecs,
    onSplitPersisted,
    request,
    restaurantSlug,
    sessionOrders,
    splitDraft,
  ]);

  useEffect(() => {
    if (splitDraft.splitMode === 'by_item') {
      onRegisterPersist(null);
      onRegisterCollectTicket(async ({ personName, partyId, modalAmount }) => {
        setSubmitting(true);
        try {
          const trimmed = personName.trim();
          if (!trimmed) {
            showToast(checkoutT.staffByItemNeedName, 'error');
            return null;
          }
          const ticketKey = splitPartyKey(partyId, trimmed);
          if (!ticketKey) {
            showToast(checkoutT.staffByItemNoCollectableShare, 'error');
            return null;
          }

          const liveTarget = resolveByItemCollectTarget({
            personName: trimmed,
            partyId,
            roster: editRoster,
            liveResults: liveByItemResults,
            collectedPayments,
          });
          if (!liveTarget || !collectModalAmountStillValid(liveTarget.amount, modalAmount)) {
            showToast(checkoutT.staffByItemNoCollectableShare, 'error');
            return null;
          }

          const liveRow = liveByItemResults.find(
            (row) => splitResultTicketKey(row) === ticketKey,
          );
          const obligation = liveRow?.amount ?? liveTarget.amount;
          if (!(obligation > 0)) {
            showToast(checkoutT.staffByItemNoCollectableShare, 'error');
            return null;
          }

          const rowAllocations = buildByItemAllocationsFromRows(
            lineSpecs,
            splitDraft.byItemAllocations,
          );
          const stamped = stampCollectTicketFrozenAmounts(
            lineSpecs,
            rowAllocations,
            ticketKey,
          );
          const allPersons = buildSplitPersonsFromAllocations(stamped);
          const ticketPerson = allPersons.find(
            (row) => splitPartyKey(row.party_id, row.name) === ticketKey,
          );
          if (!ticketPerson?.item_shares?.length) {
            showToast(checkoutT.staffByItemNoCollectableShare, 'error');
            return null;
          }

          const merged = mergeCurrentByItemTicketForCollect({
            existingPersons: request.persons ?? [],
            existingResult: (request.result ?? []) as SplitResult[],
            ticketPerson,
            ticketAmount: obligation,
          });

          const outcome = await requestCheckoutRequest({
            slug: restaurantSlug,
            tableId: request.table_id,
            splitMode: 'by_item',
            persons: merged.persons,
            result: merged.result,
            // Collect upserts one ticket only — never require Σ(result)=bill here
            // (paid freezes can leave a 1¢ gap until remaining tickets are collected).
            allowPartialByItem: true,
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
            split_mode: 'by_item',
            persons: merged.persons,
            result: outcome.result,
            status: 'requested',
          });
          const personIndex = outcome.result.findIndex(
            (row) => splitResultTicketKey(row) === ticketKey,
          );
          if (personIndex < 0) {
            showToast(checkoutT.staffByItemNoCollectableShare, 'error');
            return null;
          }
          return { personIndex };
        } finally {
          setSubmitting(false);
        }
      });
      return () => {
        onRegisterCollectTicket(null);
      };
    }

    onRegisterCollectTicket(null);
    onRegisterPersist(async () => {
      setSubmitting(true);
      try {
        return await persistSplit();
      } finally {
        setSubmitting(false);
      }
    });
    return () => onRegisterPersist(null);
  }, [
    billT,
    checkoutT,
    collectedPayments,
    editRoster,
    lineSpecs,
    liveByItemResults,
    onRegisterCollectTicket,
    onRegisterPersist,
    onSplitPersisted,
    persistSplit,
    request,
    restaurantSlug,
    splitDraft.byItemAllocations,
    splitDraft.splitMode,
  ]);

  const collectSavedPerson = useCallback(
    async (
      index: number,
      preDiscountAmount: number,
      personName?: string,
      partyId?: string,
    ) => {
      const amount = discountedObligationAmount(preDiscountAmount, discountRate);
      if (amount <= 0) {
        showToast(checkoutT.cashShort, 'error');
        return;
      }
      onCollectPerson(index, amount, personName, partyId);
    },
    [checkoutT.cashShort, discountRate, onCollectPerson],
  );

  return (
    <div className="mb-3 space-y-3">
      <SettlementBar
        summary={summary}
        discountRate={discountRate}
        discountApplying={discountApplying}
        discountLocked={discountLocked}
        detailLocked={detailLocked || submitting}
        t={checkoutT}
        stickyShellClass={stickyShellClass}
        onDiscountRateChange={onDiscountRateChange}
        onDiscountRateFocus={onDiscountRateFocus}
        onDiscountRateBlur={onDiscountRateBlur}
        leading={
          showBackButton && onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-brand-text-muted hover:text-brand-gold transition-colors"
            >
              ← {checkoutT.backToList}
            </button>
          ) : null
        }
      />
      <div className="rounded-lg border border-brand-border bg-brand-card px-2 py-3 space-y-3">
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
                  void collectSavedPerson(index, row.amount, row.name);
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
            ledgerPeople={ledgerPeople}
            settledTicketKeys={settledTicketKeys}
            lockedTicketKeys={lockedTicketKeys}
            itemCodeByMenuId={itemCodeByMenuId}
            imageUrlByMenuId={imageUrlByMenuId}
            guestName={guestName}
            labels={staffByItemLabels}
            disabled={submitting || detailLocked}
            onAllocationChange={(next) => splitDraft.setByItemAllocations(next)}
            onRenamePerson={({ oldName, newName, partyId }) => {
              splitDraft.renameByItemConsumer(oldName, newName, partyId);
            }}
            onCollectCurrent={({ personName, partyId }) => {
              const trimmed = personName.trim();
              if (!trimmed) {
                showToast(checkoutT.staffByItemNeedName, 'error');
                return;
              }
              const target = resolveByItemCollectTarget({
                personName: trimmed,
                partyId,
                roster: editRoster,
                liveResults: liveByItemResults,
                collectedPayments,
                billPending: summary.pending,
              });
              if (!target) {
                showToast(checkoutT.staffByItemNoCollectableShare, 'error');
                return;
              }
              void collectSavedPerson(
                target.index,
                target.amount,
                target.personName,
                target.partyId,
              );
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
    </div>
  );
}
