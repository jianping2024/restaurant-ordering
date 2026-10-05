'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { buildCustomerSplitDisplayRows } from '@/lib/customer-bill-split-display';
import { checkoutLinesFromOrders } from '@/lib/checkout-session-lines';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
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
import type { BillSplit, DishFeedbackVote, Order, SessionStatus, SplitResult } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { staffAssistedReturnLabel } from '@/lib/i18n/staff-assisted-messages';
import { showToast } from '@/components/ui/Toast';
import { BillDetailsSection } from '@/components/menu/BillDetailsSection';
import { GuestClaimPanel } from '@/components/menu/GuestClaimPanel';
import { BillCheckoutSubmittedScreen, type ReviewableItem } from '@/components/menu/BillCheckoutSubmittedScreen';

function BillCheckoutGateBanner({
  message,
  className = '',
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`flex gap-2.5 rounded-xl border border-amber-500 bg-amber-100 px-4 py-3 text-[14px] font-medium text-amber-950 ${className}`}
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
        subtitle={t.settlement}
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

  useEffect(() => {
    setCallBillBusy(callBillBusy);
  }, [callBillBusy, setCallBillBusy]);

  const detailLines = useMemo(
    () => checkoutLinesFromOrders(orders, lang, itemCodeByMenuId),
    [orders, lang, itemCodeByMenuId],
  );

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
    getTicket: () => myTicket,
    onCalled: async () => {
      ownCalledKeysRef.current.add(splitPartyKey(claim.claim.partyId, claim.claim.name));
      await commitIndividualCalled();
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
    },
  });

  const resolveLineName = useCallback(
    (lineKey: string) => {
      const line = splitOrderLines.find((row) => row.key === lineKey);
      return line ? resolveMenuItemLocalizedName(line, lang) : null;
    },
    [lang, splitOrderLines],
  );
  const individualNotice = (
    <IndividualCheckoutNotice
      sessionId={activeSessionId}
      enabled
      suppressModal={submitted}
      onSignals={() => void refreshBill()}
      getIgnoreTicketKeys={getIgnoreTicketKeys}
      resolveLineName={resolveLineName}
    />
  );

  /** The called screen lists only this phone's own ticket(s). */
  const calledMine = useMemo(() => {
    if (!submitted) return null;
    const results = (liveSplit?.result ?? []) as SplitResult[];
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
  }, [submitted, liveSplit?.result, individualTickets, collectedPayments, total]);

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
      wholeLabel: t.qtyWholePlaceholder,
      numLabel: t.qtyNumPlaceholder,
      denLabel: t.qtyDenPlaceholder,
      missingDen: t.qtyMissingDen,
      zeroDen: t.qtyZeroDen,
      improperFraction: t.qtyImproperFraction,
      claimedByOthers: t.claimOthers,
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
    if (claim.issue) {
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
    const fallbackOrderId = orders[0]?.id ?? '';
    const dedup = new Map<string, ReviewableItem>();
    orderLines
      .filter((item) => item.item_status !== 'voided' && item.kind !== 'buffet_base')
      .forEach((item) => {
        const existing = dedup.get(item.id);
        if (existing) {
          existing.qty += item.qty;
          return;
        }
        dedup.set(item.id, {
          menu_item_id: item.id,
          order_id: item.order_id ?? fallbackOrderId,
          name: resolveMenuItemLocalizedName(item, lang),
          emoji: item.emoji,
          image_url: imageUrlByMenuId[item.id] ?? null,
          qty: item.qty,
        });
      });
    return Array.from(dedup.values());
  }, [orderLines, orders, lang, imageUrlByMenuId]);

  const feedbackReasonLabels: Record<DishFeedbackReasonKey, string> = {
    taste: t.reasonTaste,
    temp: t.reasonTemp,
    slow: t.reasonSlow,
    mismatch: t.reasonMismatch,
    other: t.reasonOther,
  };

  const selectedFeedbackCount = Object.values(feedbackDraft).filter((entry) => !!entry.vote).length;

  useEffect(() => {
    if (!submitted || !activeSessionId || initialFeedbackSubmitted || initialFeedbackSkipped) {
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
    submitted,
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

  if (submitted) {
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
        called={{
          hint: t.individualCalledHint,
          resumeLabel: t.individualResume,
          resumeBusyLabel: t.individualResumeBusy,
          resumeBusy,
          onResume: () => void handleResume(),
        }}
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

  const pagePadClass = checkoutGateMessage ? 'pb-40' : 'pb-24';

  return (
    <>
    {individualNotice}
    <div className={`min-h-screen bg-brand-bg max-w-mobile mx-auto ${pagePadClass}`}>
      <CustomerOrderingHeader
        restaurantName={restaurant.name}
        displayName={displayName}
        tableLabel={t.table}
        staffAssisted={null}
        subtitle={t.settlement}
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

      <GuestClaimPanel
        lang={lang}
        labels={claimLabels}
        claim={claim.claim}
        lineSpecs={lineSpecs}
        orderLines={splitOrderLines}
        others={claim.others}
        overClaimedKeys={claim.overClaimedKeys}
        nameTaken={claim.nameTaken}
        disabled={isCallBillBusy}
        itemCodeByMenuId={itemCodeByMenuId}
        onNameChange={claim.setName}
        onRowChange={claim.updateRow}
        onClaimAll={claim.claimRest}
      />

      {claimIssueMessage ? (
        <p className="px-4 pb-2 text-[13px] text-brand-text-muted">{claimIssueMessage}</p>
      ) : null}

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-mobile px-4 z-20 space-y-2">
        {checkoutGateMessage ? (
          <BillCheckoutGateBanner
            message={checkoutGateMessage}
            className="shadow-md shadow-amber-900/15"
          />
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
            || claim.issue !== null
          }
        >
          🔔 {t.callBill} — €{myTicket.amount.toFixed(2)}
        </Button>
      </div>
    </div>
    </>
  );
}
