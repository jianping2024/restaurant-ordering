'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { buildCustomerSplitDisplayRows } from '@/lib/customer-bill-split-display';
import { checkoutLinesFromOrders } from '@/lib/checkout-session-lines';
import { formatChargeableShareHint } from '@/lib/format-chargeable-share-hint';
import { getMessages } from '@/lib/i18n/messages';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import { isBillGuestCountConfirmed } from '@/lib/table-guest-count';
import { isPartyMemberCountAllowedForCheckout } from '@/lib/table-party-groups';
import type { IndividualTicketInfo } from '@/lib/individual-checkout';
import { splitPartyKey, splitResultTicketKey } from '@/lib/split-party-id';
import { requestGuestUnlockTickets } from '@/lib/request-individual-checkout';
import { IndividualCheckoutNotice } from '@/components/menu/IndividualCheckoutNotice';
import { useGuestClientId } from '@/lib/table-order-round/use-guest-client-id';
import { CustomerOrderingHeader } from '@/components/menu/CustomerOrderingHeader';
import { useCustomerBillReadModel } from '@/lib/use-customer-bill-read-model';
import { useGuestClaim } from '@/lib/use-guest-claim';
import { useGuestCallCheckout } from '@/lib/use-guest-call-checkout';
import {
  DISH_FEEDBACK_REASON_KEYS,
  parseDishFeedbackReasons,
  type DishFeedbackReasonKey,
} from '@/lib/dish-feedback-reasons';
import { Button } from '@/components/ui/Button';
import { customerBottomDockSurfaceClass } from '@/lib/customer-menu-bottom-bar-layout';
import type {
  BillSplit,
  DishFeedbackVote,
  Order,
  SessionStatus,
  SplitPerson,
  SplitResult,
} from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { staffAssistedReturnLabel } from '@/lib/i18n/staff-assisted-messages';
import { showToast } from '@/components/ui/Toast';
import { BillDetailsSection } from '@/components/menu/BillDetailsSection';
import { GuestClaimPanel } from '@/components/menu/GuestClaimPanel';
import { BillSplitPanel } from '@/components/menu/BillSplitPanel';
import { BillCheckoutSubmittedScreen } from '@/components/menu/BillCheckoutSubmittedScreen';
import { buildGuestReviewableItems } from '@/lib/guest-reviewable-items';
import { getGuestSplitGuidance } from '@/lib/i18n/guest-split-mode-messages';
import {
  type GuestBillSplitMode,
  guestTablePlanHoldsCheckout,
  resolveGuestBillSplitMode,
} from '@/lib/guest-bill-split-mode';
import { useGuestEvenSplit } from '@/lib/use-guest-even-split';
import type { SplitMode } from '@/types';

function BillCheckoutGateBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex gap-2.5 rounded-xl border border-amber-500 bg-amber-100 px-4 py-3 text-[14px] font-medium text-amber-950"
    >
      <span className="shrink-0 text-base leading-5" aria-hidden>
        ⚠️
      </span>
      <p className="leading-snug">{message}</p>
    </div>
  );
}

interface Props {
  restaurant: { id: string; name: string; slug: string };
  tableId: string;
  displayName: string;
  orders: Order[];
  sessionId: string | null;
  sessionStatus: SessionStatus;
  existingSplit: BillSplit | null;
  initialCollectedPayments?: SessionCollectedPayment[];
  /** Waiter opened the bill from the floor: read-only bill details, no claiming or calling. */
  staffAssisted?: StaffAssistedFlow | null;
  initialFeedbackSubmitted?: boolean;
  initialFeedbackSkipped?: boolean;
  itemCodeByMenuId?: Record<string, string>;
  /** Catalog photo per menu item id — feedback card thumb (emoji fallback). */
  imageUrlByMenuId?: Record<string, string>;
  initialPartyMemberCount?: number;
  initialIndividualTickets?: IndividualTicketInfo[];
}

/** Customer phone: claim your own dishes and call checkout. Waiter view: details only. */
export function BillPage(props: Props) {
  return props.staffAssisted ? (
    <StaffBillDetailsView {...props} staffAssisted={props.staffAssisted} />
  ) : (
    <GuestBillPage {...props} />
  );
}

function StaffBillDetailsView({
  restaurant,
  tableId,
  displayName,
  orders: initialOrders,
  sessionId,
  sessionStatus,
  existingSplit,
  initialCollectedPayments = [],
  staffAssisted,
  itemCodeByMenuId = {},
  initialPartyMemberCount = 0,
}: Props & { staffAssisted: StaffAssistedFlow }) {
  const { lang } = useLanguage();
  const t = getMessages(lang).bill;
  const { orders, total } = useCustomerBillReadModel(
    {
      orders: initialOrders,
      partyMemberCount: initialPartyMemberCount,
      existingSplit,
      collectedPayments: initialCollectedPayments,
      sessionId,
      sessionStatus,
    },
    { slug: restaurant.slug, tableId },
  );
  const detailLines = useMemo(
    () => checkoutLinesFromOrders(orders, lang, itemCodeByMenuId),
    [orders, lang, itemCodeByMenuId],
  );
  return (
    <div className="min-h-screen bg-brand-bg max-w-mobile mx-auto pb-24">
      <CustomerOrderingHeader
        restaurantName={restaurant.name}
        displayName={displayName}
        tableLabel={t.table}
        staffAssisted={staffAssisted}
        headingSize="bill"
        backLink={{
          href: staffAssisted.returnHref,
          label: staffAssistedReturnLabel(staffAssisted, lang),
        }}
      />
      <BillDetailsSection
        title={t.details}
        totalLabel={t.total}
        lines={detailLines}
        total={total}
        formatChargeableHint={(qty, unitPrice) => formatChargeableShareHint(lang, qty, unitPrice)}
      />
    </div>
  );
}

function GuestBillPage({
  restaurant,
  tableId,
  displayName,
  orders: initialOrders,
  sessionId,
  sessionStatus,
  existingSplit,
  initialCollectedPayments = [],
  initialFeedbackSubmitted = false,
  initialFeedbackSkipped = false,
  itemCodeByMenuId = {},
  imageUrlByMenuId = {},
  initialPartyMemberCount = 0,
  initialIndividualTickets = [],
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).bill;
  const backHref = `/${restaurant.slug}/menu?table_id=${encodeURIComponent(tableId)}`;
  const guestClientId = useGuestClientId(restaurant.id, tableId);

  const {
    orders,
    partyMemberCount,
    existingSplit: liveSplit,
    collectedPayments,
    sessionId: liveSessionId,
    submitted,
    orderLines,
    splitOrderLines,
    lineSpecs,
    total,
    refreshOrders,
    commitOrders,
    lastSyncedAt,
    setCallBillBusy,
    commitIndividualCalled,
    refreshBill,
    ticketsReady,
    individualTickets,
  } = useCustomerBillReadModel(
    {
      orders: initialOrders,
      partyMemberCount: initialPartyMemberCount,
      existingSplit,
      collectedPayments: initialCollectedPayments,
      sessionId,
      sessionStatus,
      individualTickets: initialIndividualTickets,
    },
    { slug: restaurant.slug, tableId, guestClientId, enabled: true },
  );

  // Own just-called ticket: its realtime signal must not pop a notice on this phone.
  const ownCalledKeysRef = useRef(new Set<string>());
  const getIgnoreTicketKeys = useCallback(() => {
    const keys = new Set(ownCalledKeysRef.current);
    for (const ticket of individualTickets) {
      if (ticket.mine) keys.add(ticket.ticket_key);
    }
    return keys;
  }, [individualTickets]);
  // The phone id is only known after mount: reload once so `mine` ticket states are right.
  useEffect(() => {
    if (!guestClientId) return;
    void refreshBill();
  }, [guestClientId, refreshBill]);

  /** Live session from bill sync — never keep SSR session id after table reopen. */
  const activeSessionId = liveSessionId ?? sessionId;

  const [draftMode, setDraftMode] = useState<GuestBillSplitMode>('whole_table');
  const { mode: guestMode, locked: modeLocked } = resolveGuestBillSplitMode({
    draft: draftMode,
    existingSplit: liveSplit,
    collectedPaymentCount: collectedPayments.length,
  });

  const guestName = useCallback((n: number) => `${t.guest} ${n}`, [t.guest]);
  const evenSplit = useGuestEvenSplit({
    existingSplit: liveSplit,
    total,
    guestName,
    collectedPayments,
    lang,
    locked: modeLocked,
  });

  const claim = useGuestClaim({
    restaurantId: restaurant.id,
    sessionId: activeSessionId,
    lineSpecs,
    orderLines: splitOrderLines,
    existingSplit: liveSplit,
    tickets: individualTickets,
    lang,
    submitted,
  });

  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, { vote?: DishFeedbackVote; reasons: DishFeedbackReasonKey[] }>>({});
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(initialFeedbackSubmitted);
  const [feedbackSkipped, setFeedbackSkipped] = useState(initialFeedbackSkipped);
  const [feedbackHydrating, setFeedbackHydrating] = useState(
    () =>
      !!existingSplit &&
      !!activeSessionId &&
      !initialFeedbackSubmitted &&
      !initialFeedbackSkipped,
  );
  const [callBillBusy, setCallBillBusyState] = useState(false);
  const [tablePlanLocalSubmitted, setTablePlanLocalSubmitted] = useState(false);

  useEffect(() => {
    setCallBillBusy(callBillBusy);
  }, [callBillBusy, setCallBillBusy]);

  const detailLines = useMemo(
    () => checkoutLinesFromOrders(orders, lang, itemCodeByMenuId),
    [orders, lang, itemCodeByMenuId],
  );

  const tablePlanSubmitted =
    tablePlanLocalSubmitted || guestTablePlanHoldsCheckout(liveSplit);
  const billSubmitted = submitted || tablePlanSubmitted;

  const { myTicket } = claim;
  const { isCallBillBusy, submitCall } = useGuestCallCheckout({
    restaurant,
    tableId,
    orders,
    partyMemberCount,
    lastSyncedAt,
    refreshOrders,
    commitOrders,
    guestClientId,
    mode: guestMode,
    getTicket: () => myTicket,
    getEvenPayload: () => evenSplit.buildPayload(),
    total,
    onByItemCalled: async () => {
      ownCalledKeysRef.current.add(splitPartyKey(claim.claim.partyId, claim.claim.name));
      await commitIndividualCalled();
    },
    onTablePlanCalled: async () => {
      setTablePlanLocalSubmitted(true);
      await refreshBill();
    },
    onBusyChange: setCallBillBusyState,
    showToast,
    messages: {
      billSyncFailed: t.billSyncFailed,
      billIncomplete: t.billIncomplete,
      splitPlanLocked: t.splitPlanLocked,
      actionFailed: t.actionFailed,
      guestCountRequired: t.guestCountRequired,
      partyMergeRequired: t.partyMergeRequired,
      individualNothingClaimed: t.individualNothingClaimed,
      individualClaimConflict: t.individualClaimConflict,
      individualNameTaken: t.individualNameTaken,
      splitAmountMismatch: t.splitAmountMismatch,
    },
  });

  const callAmountShown =
    guestMode === 'by_item'
      ? myTicket.amount
      : guestMode === 'even'
        ? total
        : total;

  const handleModeClick = (mode: SplitMode) => {
    if (modeLocked) return;
    if (mode === 'whole_table' || mode === 'even' || mode === 'by_item') {
      setDraftMode(mode);
    }
  };

  const individualNotice = (
    <IndividualCheckoutNotice
      sessionId={activeSessionId}
      enabled
      suppressModal={submitted}
      onSignals={() => void refreshBill()}
      getIgnoreTicketKeys={getIgnoreTicketKeys}
    />
  );

  /** The called screen lists this phone's ticket (by-item) or the whole-table/even plan. */
  const calledMine = useMemo(() => {
    if (!billSubmitted) return null;
    const results = (liveSplit?.result ?? []) as SplitResult[];
    if (tablePlanSubmitted || guestMode !== 'by_item') {
      const rows = buildCustomerSplitDisplayRows(results, collectedPayments, 0, total);
      return {
        rows,
        total: Math.round(rows.reduce((sum, row) => sum + row.obligationAmount, 0) * 100) / 100,
      };
    }
    const mineKeys = new Set(
      individualTickets.filter((ticket) => ticket.mine).map((ticket) => ticket.ticket_key),
    );
    const rows = buildCustomerSplitDisplayRows(results, collectedPayments, 0, total).filter(
      (_, index) => {
        const row = results[index];
        return !!row && mineKeys.has(splitResultTicketKey(row));
      },
    );
    return {
      rows,
      total: Math.round(rows.reduce((sum, row) => sum + row.obligationAmount, 0) * 100) / 100,
    };
  }, [
    billSubmitted,
    tablePlanSubmitted,
    guestMode,
    liveSplit?.result,
    individualTickets,
    collectedPayments,
    total,
  ]);

  const [resumeBusy, setResumeBusy] = useState(false);
  /** Guest「恢复点单」: unlock this phone's called ticket, then reload the shared plan. */
  const handleResume = async () => {
    if (resumeBusy || !guestClientId) return;
    setResumeBusy(true);
    try {
      const outcome = await requestGuestUnlockTickets({
        slug: restaurant.slug,
        tableId,
        guestClientId,
      });
      if (!outcome.ok) {
        const collecting =
          outcome.error === 'ticket_collecting' || outcome.error === 'ticket_paid';
        showToast(collecting ? t.individualResumeCollecting : t.individualResumeFailed, 'error');
      }
      await refreshBill();
    } finally {
      setResumeBusy(false);
    }
  };

  const claimLabels = useMemo(
    () => ({
      left: t.claimLeft,
      over: t.claimOver,
      buffetAdultQtyLabel: t.byItemGuestTypeAdult,
      buffetChildQtyLabel: t.byItemGuestTypeChild,
      buffetGuestCounts: t.buffetGuestCounts,
      nameLabel: t.claimNameLabel,
      namePlaceholder: t.claimNamePlaceholder,
      nameRequired: t.claimNameRequired,
      nameTaken: t.individualNameTaken,
      intro: t.claimIntro,
      claimAll: t.claimAll,
      othersSection: t.claimOthersSection,
      mineLabel: t.claimMineLabel,
      unitPickerLabel: t.claimUnitPicker,
      stackLabel: t.claimStack,
      paidLockedHint: t.claimPaidLocked,
      othersLockedHint: t.claimOthersLocked,
      expandLabel: t.claimExpand,
      collapseLabel: t.claimCollapse,
    }),
    [t],
  );

  /** Name problems are shown in the name field itself; the rest under the dish list. */
  const claimIssueMessage =
    claim.issue === 'nothing_claimed'
      ? t.individualNothingClaimed
      : claim.issue === 'over_claim'
        ? t.claimOver
        : claim.issue === 'invalid_qty'
          ? t.byItemInvalidQty
          : null;

  const guestCountConfirmed = isBillGuestCountConfirmed(orders);
  const partyCheckoutAllowed = isPartyMemberCountAllowedForCheckout(partyMemberCount);
  const checkoutGateMessage = !guestCountConfirmed
    ? t.guestCountRequired
    : !partyCheckoutAllowed
      ? t.partyMergeRequired
      : null;

  const handleCallBill = () => {
    if (!guestCountConfirmed) {
      showToast(t.guestCountRequired, 'error');
      return;
    }
    if (!partyCheckoutAllowed) {
      showToast(t.partyMergeRequired, 'error');
      return;
    }
    if (guestMode === 'by_item' && claim.issue) {
      showToast(
        claim.issue === 'name_required'
          ? t.claimNameRequired
          : claim.issue === 'name_taken'
            ? t.individualNameTaken
            : (claimIssueMessage ?? t.actionFailed),
        'error',
      );
      return;
    }
    void submitCall();
  };

  const reviewableItems = useMemo(() => {
    const mineTicketKeys = new Set(
      individualTickets.filter((ticket) => ticket.mine).map((ticket) => ticket.ticket_key),
    );
    return buildGuestReviewableItems({
      splitMode: guestMode,
      orderLines,
      splitOrderLines,
      persons: (liveSplit?.persons ?? []) as SplitPerson[],
      mineTicketKeys,
      lang,
      imageUrlByMenuId,
      fallbackOrderId: orders[0]?.id ?? '',
    });
  }, [
    guestMode,
    orderLines,
    splitOrderLines,
    liveSplit?.persons,
    individualTickets,
    lang,
    imageUrlByMenuId,
    orders,
  ]);

  const feedbackReasonLabels: Record<DishFeedbackReasonKey, string> = {
    taste: t.reasonTaste,
    temp: t.reasonTemp,
    slow: t.reasonSlow,
    mismatch: t.reasonMismatch,
    other: t.reasonOther,
  };

  const selectedFeedbackCount = Object.values(feedbackDraft).filter((entry) => !!entry.vote).length;

  useEffect(() => {
    if (!billSubmitted || !activeSessionId || initialFeedbackSubmitted || initialFeedbackSkipped) {
      return;
    }
    setFeedbackHydrating(true);
    const syncFeedbackState = async () => {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(restaurant.slug)}/customer/dish-feedback?table_id=${encodeURIComponent(tableId)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        submitted?: boolean;
        skipped?: boolean;
        votes?: Array<{ menu_item_id?: string; vote?: string; reasons?: unknown }>;
      };
      if (data.skipped) {
        setFeedbackSkipped(true);
        return;
      }
      const votes = Array.isArray(data.votes) ? data.votes : [];
      if (!votes.length && !data.submitted) return;
      const nextDraft: Record<string, { vote?: DishFeedbackVote; reasons: DishFeedbackReasonKey[] }> = {};
      for (const row of votes) {
        const menuItemId =
          typeof row.menu_item_id === 'string' ? row.menu_item_id.trim() : '';
        if (!menuItemId) continue;
        const vote = row.vote === 'up' || row.vote === 'down' ? row.vote : undefined;
        const reasons =
          vote === 'down' ? parseDishFeedbackReasons(row.reasons) : [];
        nextDraft[menuItemId] = { vote, reasons };
      }
      setFeedbackDraft(nextDraft);
      if (data.submitted || votes.length > 0) setFeedbackSubmitted(true);
    };
    void syncFeedbackState().finally(() => setFeedbackHydrating(false));
  }, [
    billSubmitted,
    activeSessionId,
    restaurant.slug,
    tableId,
    initialFeedbackSubmitted,
    initialFeedbackSkipped,
  ]);

  const setVote = (menuItemId: string, vote: DishFeedbackVote) => {
    setFeedbackDraft((prev) => ({
      ...prev,
      [menuItemId]: {
        vote,
        reasons: vote === 'down' ? (prev[menuItemId]?.reasons || []) : [],
      },
    }));
  };

  const toggleReason = (menuItemId: string, reason: DishFeedbackReasonKey) => {
    setFeedbackDraft((prev) => {
      const existing = prev[menuItemId] || {
        vote: 'down' as DishFeedbackVote,
        reasons: [] as DishFeedbackReasonKey[],
      };
      const reasons = existing.reasons.includes(reason)
        ? existing.reasons.filter((item) => item !== reason)
        : [...existing.reasons, reason];
      return {
        ...prev,
        [menuItemId]: {
          vote: 'down',
          reasons,
        },
      };
    });
  };

  const handleSkipFeedback = async () => {
    if (!activeSessionId || feedbackSkipped || feedbackSubmitting) return;
    setFeedbackSubmitting(true);
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(restaurant.slug)}/customer/dish-feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_id: tableId, action: 'skip' }),
        },
      );
      if (!res.ok) {
        showToast(t.actionFailed);
        return;
      }
      setFeedbackSkipped(true);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!activeSessionId || selectedFeedbackCount === 0) return;
    setFeedbackSubmitting(true);
    try {
      const payload = reviewableItems
        .map((item) => {
          const draft = feedbackDraft[item.menu_item_id];
          if (!draft?.vote) return null;
          return {
            menu_item_id: item.menu_item_id,
            order_id: item.order_id,
            vote: draft.vote,
            reasons: draft.vote === 'down' ? draft.reasons : [],
          };
        })
        .filter((row): row is NonNullable<typeof row> => !!row);

      if (payload.length === 0) return;

      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(restaurant.slug)}/customer/dish-feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_id: tableId,
            action: 'submit',
            items: payload,
            ...(guestClientId ? { guest_client_id: guestClientId } : {}),
          }),
        },
      );
      if (!res.ok) {
        showToast(t.actionFailed);
        return;
      }

      setFeedbackSubmitted(true);
      setFeedbackSkipped(false);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // The editor renders only after a read that carried this phone's id, so it never flashes
  // for a phone whose own ticket is already called.
  if (!ticketsReady) {
    return <div className="min-h-screen bg-brand-bg" aria-busy="true" />;
  }

  if (billSubmitted) {
    return (
      <>
      {individualNotice}
      <BillCheckoutSubmittedScreen
        restaurantName={restaurant.name}
        displayName={displayName}
        tableLabel={t.table}
        lang={lang}
        copy={{
          checkoutSubmittedHint: t.checkoutSubmittedHint,
          totalLabel: t.totalLabel,
          splitResult: t.splitResult,
          splitPaid: t.splitPaid,
          splitPartialPaid: t.splitPartialPaid,
          splitAmountBreakdown: t.splitAmountBreakdown,
          refreshPage: t.refreshPage,
          feedbackTitle: t.feedbackTitle,
          feedbackHint: t.feedbackHint,
          feedbackSkip: t.feedbackSkip,
          feedbackSubmit: t.feedbackSubmit,
          feedbackThanks: t.feedbackThanks,
          thumbsUp: t.thumbsUp,
          thumbsDown: t.thumbsDown,
          noFeedbackItems: t.noFeedbackItems,
        }}
        total={calledMine?.total ?? total}
        splitRows={calledMine?.rows ?? []}
        called={
          guestMode === 'by_item' && submitted
            ? {
                hint: t.individualCalledHint,
                resumeLabel: t.individualResume,
                resumeBusyLabel: t.individualResumeBusy,
                resumeBusy,
                onResume: () => void handleResume(),
              }
            : null
        }
        backHref={backHref}
        backLabel={t.backToMenu}
        onRefreshPage={() => window.location.reload()}
        showFeedback={!feedbackSkipped}
        reviewableItems={reviewableItems}
        feedbackDraft={feedbackDraft}
        feedbackReasonLabels={feedbackReasonLabels}
        feedbackReasonKeys={DISH_FEEDBACK_REASON_KEYS}
        feedbackHydrating={feedbackHydrating}
        feedbackSubmitted={feedbackSubmitted}
        feedbackSubmitting={feedbackSubmitting}
        selectedFeedbackCount={selectedFeedbackCount}
        onVote={setVote}
        onToggleReason={toggleReason}
        onSkipFeedback={() => void handleSkipFeedback()}
        onSubmitFeedback={() => void handleSubmitFeedback()}
      />
      </>
    );
  }

  // Clears the solid call-checkout dock (button row, + gate banner) and the bottom safe area.
  const pagePadClass = checkoutGateMessage
    ? 'pb-[calc(10rem+var(--mesa-customer-menu-bottom-safe))]'
    : 'pb-[calc(6rem+var(--mesa-customer-menu-bottom-safe))]';

  return (
    <>
    {individualNotice}
    <div
      data-guest-bill-page=""
      className={`min-h-screen bg-brand-bg max-w-mobile mx-auto ${pagePadClass}`}
    >
      <CustomerOrderingHeader
        restaurantName={restaurant.name}
        displayName={displayName}
        tableLabel={t.table}
        staffAssisted={null}
        headingSize="bill"
        backLink={{ href: backHref, label: t.backToMenu }}
      />

      <BillDetailsSection
        title={t.details}
        totalLabel={t.total}
        lines={detailLines}
        total={total}
        formatChargeableHint={(qty, unitPrice) =>
          formatChargeableShareHint(lang, qty, unitPrice)
        }
      />

      <BillSplitPanel
        lang={lang}
        copy={{
          splitMode: t.splitMode,
          splitPlanLocked: t.splitPlanLocked,
          people: t.people,
          splitResult: t.splitResult,
          splitPaid: t.splitPaid,
          splitPartialPaid: t.splitPartialPaid,
          splitAmountBreakdown: t.splitAmountBreakdown,
        }}
        splitGuidance={getGuestSplitGuidance(lang)}
        splitMode={guestMode}
        splitLocked={modeLocked}
        submitting={isCallBillBusy}
        personCount={evenSplit.personCount}
        splitPeople={evenSplit.splitPeople}
        results={guestMode === 'even' ? evenSplit.results : []}
        splitDisplayRows={guestMode === 'even' ? evenSplit.splitDisplayRows : []}
        lockedPersonNames={new Set()}
        splitValidationMessage={null}
        guestName={guestName}
        editingSplitNameIndex={evenSplit.editingSplitNameIndex}
        editingSplitNameValue={evenSplit.editingSplitNameValue}
        onSplitModeClick={handleModeClick}
        onDecrementPersonCount={evenSplit.decrementPersonCount}
        onIncrementPersonCount={evenSplit.incrementPersonCount}
        onStartInlineRename={evenSplit.startInlineRename}
        onCommitInlineRename={evenSplit.commitInlineRename}
        onEditingSplitNameValueChange={evenSplit.setEditingSplitNameValue}
        onCancelInlineRename={evenSplit.cancelInlineRename}
        byItemContent={
          guestMode === 'by_item' ? (
            <GuestClaimPanel
              lang={lang}
              labels={claimLabels}
              claim={claim.claim}
              lineSpecs={lineSpecs}
              orderLines={splitOrderLines}
              others={claim.others}
              othersBlocks={claim.othersBlocks}
              overClaimedKeys={claim.overClaimedKeys}
              nameTaken={claim.nameTaken}
              disabled={isCallBillBusy}
              itemCodeByMenuId={itemCodeByMenuId}
              onNameChange={claim.setName}
              onRowChange={claim.updateRow}
              onClaimAll={claim.claimRest}
            />
          ) : null
        }
      />

      {guestMode === 'by_item' && claimIssueMessage ? (
        <p className="px-4 pb-2 text-[13px] text-brand-text-muted">{claimIssueMessage}</p>
      ) : null}

      {/* Yields while a bill-page text field is focused — sole rule in globals.css. */}
      <div
        data-guest-call-checkout-dock=""
        className={`${customerBottomDockSurfaceClass} w-full max-w-mobile`}
      >
        <div className="space-y-2 px-4 py-3">
          {checkoutGateMessage ? (
            <BillCheckoutGateBanner message={checkoutGateMessage} />
          ) : null}
          <Button
            className="w-full"
            size="lg"
            onClick={handleCallBill}
            loading={isCallBillBusy}
            disabled={
              orderLines.length === 0
              || !activeSessionId
              || isCallBillBusy
              || !guestCountConfirmed
              || !partyCheckoutAllowed
              || (guestMode === 'by_item' && claim.issue !== null)
            }
          >
            🔔 {t.callBill} — €{callAmountShown.toFixed(2)}
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}
