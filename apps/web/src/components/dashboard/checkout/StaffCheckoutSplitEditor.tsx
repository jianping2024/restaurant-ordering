'use client';

import type { StaffTicketUnlock } from '@/components/dashboard/checkout/staff-ticket-unlock';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BillSplitPanel } from '@/components/menu/BillSplitPanel';
import {
  CheckoutPathChooserBackButton,
} from '@/components/dashboard/checkout/checkout-detail-phase';
import {
  CheckoutSessionActions,
  SettlementBar,
} from '@/components/dashboard/checkout/CheckoutRequestDetail';
import { CheckoutTableItemsSection } from '@/components/dashboard/checkout/CheckoutTableItemsSection';
import {
  StaffByItemPersonShareSummary,
  StaffByItemSplitWorkbench,
} from '@/components/dashboard/checkout/StaffByItemSplitWorkbench';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { showToast } from '@/components/ui/Toast';
import { checkoutLinesFromOrders } from '@/lib/checkout-session-lines';
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
  mergeStaffByItemUnpaidDraftIntoLedger,
  resolveByItemCollectTarget,
  resolveStaffByItemEditRoster,
  settledByItemPersonKeys,
} from '@/lib/checkout-by-item-collect';
import {
  isSplitSettlementPending,
  splitSettlementCollectAmount,
} from '@/lib/checkout-split-settlement';
import { buildCustomerSplitDisplayRows } from '@/lib/customer-bill-split-display';
import {
  resolveStaffByItemRailPeople,
  staffByItemLedgerPeople,
  staffByItemLockedLedgerPeople,
  staffByItemRailPersonKey,
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
import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';
import {
  resumeCheckoutBlockReason,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import { useBillSplitDraft } from '@/lib/use-bill-split-draft';
import type { BillSplit, Order, SplitPerson, SplitResult } from '@/types';

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
  /** Leave checkout → table detail (sole cancel). */
  onCancel: () => void;
  /** Mobile back to queue — rendered inside sticky SettlementBar chrome. */
  showBackButton?: boolean;
  onBack?: () => void;
  /** Sticky shell for SettlementBar — default under staff top bar. */
  stickyShellClass?: string;
  /** Sole discount commit from IntegerInput onChange (blur parse). */
  onDiscountRateCommit: (rate: number) => void;
  onDiscountRateFocus: () => void;
  onResumeOrderingClick: () => void;
  /** Individual-checkout plans: staff「解锁」for called, uncollected tickets. */
  ticketUnlock?: StaffTicketUnlock;
  onCollectPerson: (
    index: number,
    amount: number,
    personName?: string,
    partyId?: string,
    preDiscountAmount?: number,
    wholeTable?: boolean,
  ) => void;
  onSplitPersisted: (row: BillSplit) => void;
  /**
   * Even: full split persist before collect.
   * By-item: unpaid plan flush ({@link mergeStaffByItemUnpaidDraftIntoLedger}) —
   * resume and Host pay-path both call this; collect stamps then same merge.
   * Returns persons+result so resume name gate sees the flushed roster.
   */
  onRegisterPersist: (
    persist: (() => Promise<{ persons: BillSplit['persons']; result: SplitResult[] } | null>) | null,
  ) => void;
  /** By-item collect confirm: stamp ticket then unpaid-plan merge; modal amount authoritative. */
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
 * Draft + even chrome shared with guest BillSplitPanel;
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
  onCancel,
  showBackButton = false,
  onBack,
  stickyShellClass,
  onDiscountRateCommit,
  onDiscountRateFocus,
  onResumeOrderingClick,
  ticketUnlock,
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

  /** Sole staff checkout dish list — same paper lines as order history. */
  const tableLines = useMemo(
    () => checkoutLinesFromOrders(sessionOrders, lang, itemCodeByMenuId),
    [sessionOrders, lang, itemCodeByMenuId],
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
    submitting,
    discountRate,
  });

  const staffByItemLabels = useMemo(
    () => ({
      poolTitle: checkoutT.staffByItemPool,
      currentShareTitle: checkoutT.staffByItemCurrentShare,
      markerPlaceholder: billT.consumerNamePlaceholder,
      remainingPrefix: checkoutT.staffByItemRemaining,
      shareEmpty: checkoutT.staffByItemShareEmpty,
      estimateMeta: (n: number) =>
        checkoutT.staffByItemEstimateMeta.replace('{n}', String(n)),
      needName: checkoutT.staffByItemNeedName,
      poolEmpty: checkoutT.staffByItemPoolEmpty,
      assignAll: checkoutT.staffByItemAssignAll,
      poolAddAdult: checkoutT.staffByItemPoolAddAdult,
      poolAddChild: checkoutT.staffByItemPoolAddChild,
      poolAddWhole: checkoutT.staffByItemPoolAddWhole,
      poolAddFraction: (denominator: number) =>
        checkoutT.staffByItemPoolAddFraction.replace('{den}', String(denominator)),
      poolPickUnit: checkoutT.staffByItemPoolPickUnit,
      poolCancelPick: checkoutT.staffByItemPoolCancelPick,
      unitLocked: (denominator: number) =>
        checkoutT.staffByItemUnitLocked.replace('{den}', String(denominator)),
      remove: checkoutT.returnShareToPool,
      collect: checkoutT.collectPerson,
      paidShareBadge: checkoutT.staffByItemPaidShare,
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

  /** Lock set before live calc — unpaid chips come from coalesced allocations, not raw result. */
  const lockedTicketKeysFromLedger = useMemo(
    () => allocationLockedTicketKeys(request, collectedPayments),
    [collectedPayments, request],
  );

  /**
   * Guest/staff persons landed but not all tickets are in allocations yet (hydrate lag).
   * Sole gate for workbench to suppress blank「客人 1」mint — pairs with resolveStaffByItemRailPeople.
   */
  const awaitingByItemRailHydrate = useMemo(() => {
    if (splitDraft.splitMode !== 'by_item') return false;
    const fromPersons = staffByItemLedgerPeople(
      (request.persons ?? []).map((row) => ({
        name: row.name,
        ...(row.party_id?.trim() ? { partyId: row.party_id.trim() } : {}),
      })),
    );
    if (fromPersons.length === 0) return false;
    const allocKeys = new Set(
      staffByItemPeopleFromAllocations(splitDraft.byItemAllocations).map((person) =>
        staffByItemRailPersonKey(person),
      ),
    );
    return fromPersons.some((person) => {
      const key = staffByItemRailPersonKey(person);
      return Boolean(key && !allocKeys.has(key));
    });
  }, [request.persons, splitDraft.byItemAllocations, splitDraft.splitMode]);

  const byItemRailOrderPeople = useMemo(() => {
    if (splitDraft.splitMode !== 'by_item') return [] as StaffByItemRailPerson[];
    return resolveStaffByItemRailPeople({
      lockedLedgerPeople: staffByItemLockedLedgerPeople(
        ledgerPeople,
        lockedTicketKeysFromLedger,
      ),
      allocationPeople: staffByItemPeopleFromAllocations(splitDraft.byItemAllocations),
      awaitingHydrate: awaitingByItemRailHydrate,
    });
  }, [
    awaitingByItemRailHydrate,
    ledgerPeople,
    lockedTicketKeysFromLedger,
    splitDraft.byItemAllocations,
    splitDraft.splitMode,
  ]);

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
      byItemRailOrderPeople.length > 0
        ? byItemRailOrderPeople
        : staffByItemPeopleFromAllocations(splitDraft.byItemAllocations);
    const calc = calcByItemSplitResults({
      lines,
      allocations,
      personOrder: orderPeople.map((p) => p.name),
      personPartyIds: orderPeople.map((p) => p.partyId),
    });
    return calc.map((row) => toWireSplitResult(row));
  }, [
    byItemRailOrderPeople,
    lang,
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

  /**
   * Sole staff by-item「分单结果」+ persist roster: same order/amounts as collect
   * (`editRoster`). Never zip allocation first-seen order with person_index payments.
   */
  const byItemDisplayResults = useMemo(
    () => applyCollectedObligationFloors(editRoster, collectedPayments),
    [collectedPayments, editRoster],
  );
  const byItemSplitDisplayRows = useMemo(
    () =>
      buildCustomerSplitDisplayRows(
        byItemDisplayResults,
        collectedPayments,
        discountRate,
        total,
      ),
    [byItemDisplayResults, collectedPayments, discountRate, total],
  );

  const settledTicketKeys = useMemo(
    () =>
      settledByItemPersonKeys(editRoster, collectedPayments, discountRate, total),
    [collectedPayments, discountRate, editRoster, total],
  );

  const lockedTicketKeys = useMemo(() => {
    const keys = new Set(allocationLockedTicketKeys(request, collectedPayments));
    for (const key of Array.from(settledTicketKeys)) keys.add(key);
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

  const persistSplit = useCallback(async (): Promise<{
    persons: BillSplit['persons'];
    result: SplitResult[];
  } | null> => {
    const effectiveMode = splitDraft.splitMode ?? 'whole_table';
    const draftInput =
      splitDraft.resolveSplitDraftInputForSubmit?.() ?? splitDraft.splitDraftInput;
    const allocations =
      effectiveMode === 'by_item'
        ? buildByItemAllocationsFromRows(lineSpecs, splitDraft.byItemAllocations)
        : undefined;
    const poolComplete =
      effectiveMode === 'by_item' &&
      allocations != null &&
      byItemPoolFullyAllocated(lineSpecs, allocations);
    const allowPartialByItem = effectiveMode === 'by_item' && !poolComplete;
    const validated = validateSubmitSplitDraft(
      { ...draftInput, splitMode: effectiveMode },
      sessionOrders,
      { allowPartialByItem },
    );
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
      effectiveMode === 'by_item'
        ? applyCollectedObligationFloors(validated.submitResults, collectedPayments)
        : validated.submitResults;
    const persons = buildSubmitPersons({
      splitMode: effectiveMode,
      submitResults: resultPayload,
      splitPeople: splitDraft.splitPeople,
      buildPersonsForSubmit: splitDraft.buildPersonsForSubmit,
    });
    const outcome = await requestCheckoutRequest({
      slug: restaurantSlug,
      tableId: request.table_id,
      splitMode: effectiveMode,
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
      split_mode: effectiveMode,
      persons,
      result: outcome.result,
      status: 'requested',
    });
    return { persons, result: outcome.result };
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

  /**
   * Sole by-item unpaid plan → ledger (resume flush + collect after stamp).
   * Only the collect write may re-cut a dish the stored plan already cut (`allowCutChange`).
   */
  const persistByItemUnpaidPlan = useCallback(
    async (params: {
      draftPersons: ReturnType<typeof buildSplitPersonsFromAllocations>;
      draftResults: SplitResult[];
      allowCutChange?: boolean;
    }): Promise<{ persons: SplitPerson[]; result: SplitResult[] } | null> => {
      const lockedTicketKeys = allocationLockedTicketKeys(request, collectedPayments);
      const merged = mergeStaffByItemUnpaidDraftIntoLedger({
        existingPersons: request.persons ?? [],
        existingResult: (request.result ?? []) as SplitResult[],
        draftPersons: params.draftPersons,
        draftResults: params.draftResults,
        lockedTicketKeys,
      });
      const outcome = await requestCheckoutRequest({
        slug: restaurantSlug,
        tableId: request.table_id,
        splitMode: 'by_item',
        persons: merged.persons,
        result: merged.result,
        allowPartialByItem: true,
        allowCutChange: params.allowCutChange,
      });
      if (!outcome.ok) {
        const rejectedLine = splitOrderLines.find((line) => line.key === outcome.lineKeys?.[0]);
        showToast(
          messageForCheckoutRequestError(
            outcome.error,
            {
              guestCountRequired: checkoutT.callCheckoutGuestCountRequired,
              partyMergeRequired: checkoutT.callCheckoutPartyMergeRequired,
              emptySession: checkoutT.callCheckoutEmptySession,
              noActiveSession: checkoutT.callCheckoutNoActiveSession,
              tableNotAvailable: checkoutT.callCheckoutTableNotAvailable,
              invalidNif: billT.nifInvalid,
              splitPlanLocked: billT.splitPlanLocked,
              individualUnitMismatch: checkoutT.byItemUnitMismatch,
              byItemCutChangeAtCollect: checkoutT.byItemCutChangeAtCollect,
              fallback: checkoutT.callCheckoutFailed,
            },
            undefined,
            rejectedLine
              ? { dish: resolveMenuItemLocalizedName(rejectedLine, lang) }
              : undefined,
          ),
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
      return { persons: merged.persons, result: outcome.result };
    },
    [
      billT.nifInvalid,
      billT.splitPlanLocked,
      checkoutT,
      collectedPayments,
      lang,
      onSplitPersisted,
      request,
      restaurantSlug,
      splitOrderLines,
    ],
  );

  useEffect(() => {
    if ((splitDraft.splitMode ?? 'whole_table') === 'by_item') {
      onRegisterPersist(async () => {
        setSubmitting(true);
        try {
          const rowAllocations = buildByItemAllocationsFromRows(
            lineSpecs,
            splitDraft.byItemAllocations,
          );
          const draftPersons = buildSplitPersonsFromAllocations(rowAllocations);
          const draftResults = applyCollectedObligationFloors(
            editRoster,
            collectedPayments,
          );
          return await persistByItemUnpaidPlan({ draftPersons, draftResults });
        } finally {
          setSubmitting(false);
        }
      });
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
            discountRate,
            billTotalAmount: total,
          });
          if (!liveTarget || !collectModalAmountStillValid(liveTarget.amount, modalAmount)) {
            showToast(checkoutT.staffByItemNoCollectableShare, 'error');
            return null;
          }

          const rosterRow = editRoster.find(
            (row) => splitResultTicketKey(row) === ticketKey,
          );
          // Stamp pre-discount obligation on result; modal/payment use discounted liveTarget.
          const obligation = rosterRow?.amount ?? 0;
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

          const draftResults = applyCollectedObligationFloors(
            editRoster.map((row) =>
              splitResultTicketKey(row) === ticketKey
                ? toWireSplitResult({ ...row, amount: obligation })
                : toWireSplitResult(row),
            ),
            collectedPayments,
          );
          const persisted = await persistByItemUnpaidPlan({
            draftPersons: allPersons,
            draftResults,
            allowCutChange: true,
          });
          if (!persisted) return null;
          const personIndex = persisted.result.findIndex(
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
        onRegisterPersist(null);
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
    discountRate,
    editRoster,
    lineSpecs,
    liveByItemResults,
    onRegisterCollectTicket,
    onRegisterPersist,
    persistByItemUnpaidPlan,
    persistSplit,
    splitDraft.byItemAllocations,
    splitDraft.splitMode,
    total,
  ]);

  const collectSavedPerson = useCallback(
    async (
      index: number,
      collectAmount: number,
      personName?: string,
      partyId?: string,
      preDiscountAmount?: number,
    ) => {
      if (collectAmount <= 0) {
        showToast(checkoutT.cashShort, 'error');
        return;
      }
      const effectiveMode = splitDraft.splitMode ?? 'whole_table';
      onCollectPerson(
        index,
        collectAmount,
        personName,
        partyId,
        preDiscountAmount,
        effectiveMode === 'whole_table',
      );
    },
    [checkoutT.cashShort, onCollectPerson, splitDraft.splitMode],
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
        onDiscountRateCommit={onDiscountRateCommit}
        onDiscountRateFocus={onDiscountRateFocus}
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
          splitPaid: billT.splitPaid,
          splitPartialPaid: billT.splitPartialPaid,
          splitAmountBreakdown: billT.splitAmountBreakdown,
        }}
        splitGuidance={getGuestSplitGuidance(lang)}
        splitMode={splitDraft.splitMode}
        splitLocked={splitDraft.splitLocked}
        modeChipsLocked={splitDraft.modeChipsLocked}
        submitting={submitting}
        personCount={splitDraft.personCount}
        splitPeople={splitDraft.splitPeople}
        results={
          splitDraft.splitMode === 'by_item' ? byItemDisplayResults : splitDraft.results
        }
        splitDisplayRows={
          splitDraft.splitMode === 'by_item'
            ? byItemSplitDisplayRows
            : splitDraft.splitDisplayRows
        }
        lockedPersonNames={splitDraft.lockedPersonNames}
        splitValidationMessage={splitValidationMessage}
        guestName={guestName}
        editingSplitNameIndex={splitDraft.editingSplitNameIndex}
        editingSplitNameValue={splitDraft.editingSplitNameValue}
        onSplitModeClick={splitDraft.handleSplitModeClick}
        onDecrementPersonCount={splitDraft.decrementPersonCount}
        onIncrementPersonCount={splitDraft.incrementPersonCount}
        onStartInlineRename={splitDraft.startInlineRename}
        onCommitInlineRename={splitDraft.commitInlineRename}
        onEditingSplitNameValueChange={splitDraft.setEditingSplitNameValue}
        onCancelInlineRename={() => {
          splitDraft.setEditingSplitNameIndex(null);
          splitDraft.setEditingSplitNameValue('');
        }}
        staffRowActions={
          splitDraft.splitMode === 'by_item'
            ? undefined
            : {
                collectLabel: checkoutT.collectPerson,
                busy: submitting || detailLocked,
                discountRate,
                discountPreLabel: checkoutT.discountPreAmount,
                onCollect: (index) => {
                  const row = splitDraft.results[index];
                  const settlementRow = splitDraft.splitDisplayRows[index];
                  if (!row || !settlementRow || !isSplitSettlementPending(settlementRow)) {
                    return;
                  }
                  void collectSavedPerson(
                    index,
                    splitSettlementCollectAmount(settlementRow),
                    row.name,
                    undefined,
                    row.amount,
                  );
                },
              }
        }
        rowDetail={
          splitDraft.splitMode === 'by_item'
            ? {
                expandLabel: checkoutT.personShareItemsExpand,
                collapseLabel: checkoutT.personShareItemsCollapse,
                render: (row) => (
                  <StaffByItemPersonShareSummary
                    personName={row.name}
                    partyId={row.party_id}
                    lang={lang}
                    lineSpecs={lineSpecs}
                    orderLines={splitOrderLines}
                    byItemAllocations={splitDraft.byItemAllocations}
                    itemCodeByMenuId={itemCodeByMenuId}
                    labels={staffByItemLabels}
                  />
                ),
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
            awaitingRailHydrate={awaitingByItemRailHydrate}
            itemCodeByMenuId={itemCodeByMenuId}
            imageUrlByMenuId={imageUrlByMenuId}
            guestName={guestName}
            discountRate={discountRate}
            billTotalAmount={total}
            discountPreLabel={checkoutT.discountPreAmount}
            labels={staffByItemLabels}
            disabled={submitting || detailLocked}
            onAllocationChange={(next) => splitDraft.setByItemAllocations(next)}
            onRecordShareOmit={splitDraft.recordStaffByItemShareOmit}
            onClearShareOmit={splitDraft.clearStaffByItemShareOmit}
            onRenamePerson={({ oldName, newName, partyId }) => {
              splitDraft.renameByItemConsumer(oldName, newName, partyId);
            }}
            ticketUnlock={ticketUnlock}
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
                discountRate,
                billTotalAmount: total,
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
                target.preDiscountObligation,
              );
            }}
          />
        )}
      />
      <CheckoutTableItemsSection
        lines={tableLines}
        total={total}
        defaultOpen={false}
        labels={{
          orderItemsCount: checkoutT.orderItemsCount,
          orderItemsEmpty: checkoutT.orderItemsEmpty,
          orderItemsTotal: checkoutT.orderItemsTotal,
        }}
      />
      <CheckoutSessionActions
        t={checkoutT}
        detailLocked={detailLocked || submitting}
        resumeOperating={resumeOperating}
        resumeBlockReason={resumeCheckoutBlockReason(
          {
            ...request,
            // Draft tab wins: by-item workbench must not keep session「恢复点单」.
            split_mode: splitDraft.splitMode ?? request.split_mode,
          },
          collectedPayments,
        )}
        onResumeOrderingClick={onResumeOrderingClick}
        leading={
          <CheckoutPathChooserBackButton
            label={checkoutT.pathChooserBack}
            onClick={onCancel}
            disabled={submitting || detailLocked}
          />
        }
      />
      </div>
    </div>
  );
}
