'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import {
  customerBillCallAmount,
  submittedSplitResult,
} from '@/lib/customer-bill-split-display';
import { checkoutLinesFromOrders } from '@/lib/checkout-session-lines';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { formatChargeableShareHint } from '@/lib/format-chargeable-share-hint';
import { getMessages } from '@/lib/i18n/messages';
import { getGuestSplitGuidance } from '@/lib/i18n/guest-split-mode-messages';
import { formatPortugueseNif, validatePortugueseNif } from '@/lib/pt-nif';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import { isBillGuestCountConfirmed } from '@/lib/table-guest-count';
import { isPartyMemberCountAllowedForCheckout } from '@/lib/table-party-groups';
import { guestBillCollectsCustomerNif } from '@/lib/checkout-request-submit';
import { useCheckoutRequestSubmit } from '@/lib/use-checkout-request-submit';
import type { IndividualTicketInfo } from '@/lib/individual-checkout';
import { splitResultTicketKey } from '@/lib/split-party-id';
import { requestGuestUnlockTickets } from '@/lib/request-individual-checkout';
import { IndividualCheckoutNotice } from '@/components/menu/IndividualCheckoutNotice';
import { useGuestClientId } from '@/lib/table-order-round/use-guest-client-id';
import { CustomerOrderingHeader } from '@/components/menu/CustomerOrderingHeader';
import { useCustomerBillReadModel } from '@/lib/use-customer-bill-read-model';
import { useBillSplitDraft } from '@/lib/use-bill-split-draft';
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
import { BillSplitPanel } from '@/components/menu/BillSplitPanel';
import { BillCheckoutSubmittedScreen, type ReviewableItem } from '@/components/menu/BillCheckoutSubmittedScreen';
import { customerNifInputClass } from '@/components/menu/customer-form-input-styles';
import { GuestConsumerNameEditChromeProvider } from '@/components/menu/guest-consumer-name-edit-chrome';

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
  staffAssisted?: StaffAssistedFlow | null;
  initialFeedbackSubmitted?: boolean;
  initialFeedbackSkipped?: boolean;
  itemCodeByMenuId?: Record<string, string>;
  /** Catalog photo per menu item id — feedback card thumb (emoji fallback). */
  imageUrlByMenuId?: Record<string, string>;
  initialPartyMemberCount?: number;
  /** Session stamped individual_checkout (feature `guest_individual_checkout`). */
  initialIndividualCheckout?: boolean;
  initialIndividualTickets?: IndividualTicketInfo[];
}

export function BillPage({
  restaurant,
  tableId,
  displayName,
  orders: initialOrders,
  sessionId,
  sessionStatus,
  existingSplit,
  initialCollectedPayments = [],
  staffAssisted = null,
  initialFeedbackSubmitted = false,
  initialFeedbackSkipped = false,
  itemCodeByMenuId = {},
  imageUrlByMenuId = {},
  initialPartyMemberCount = 0,
  initialIndividualCheckout = false,
  initialIndividualTickets = [],
}: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).bill;
  const backHref = staffAssisted?.returnHref
    ?? `/${restaurant.slug}/menu?table_id=${encodeURIComponent(tableId)}`;
  const backLabel = staffAssisted
    ? staffAssistedReturnLabel(staffAssisted, lang)
    : t.backToMenu;
  const checkoutRedirectHref = staffAssisted?.checkoutRedirectHref ?? null;

  const guestName = useCallback((n: number) => `${t.guest} ${n}`, [t.guest]);
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
    commitSubmittedCheckout,
    commitIndividualCalled,
    refreshBill,
    individualCheckout: individualSession,
    individualReady,
    individualTickets,
    individualReadOnlyKeys,
  } = useCustomerBillReadModel(
    {
      orders: initialOrders,
      partyMemberCount: initialPartyMemberCount,
      existingSplit,
      collectedPayments: initialCollectedPayments,
      sessionId,
      sessionStatus,
      individualCheckout: initialIndividualCheckout,
      individualTickets: initialIndividualTickets,
    },
    {
      slug: restaurant.slug,
      tableId,
      guestClientId,
      enabled: true,
    },
  );
  // Staff driving the guest bill page keeps the staff checkout path (whole plan, redirect).
  const individualGuest = individualSession && !staffAssisted;

  // Own just-called tickets: their realtime signal must not pop a notice on this phone.
  const ownCalledKeysRef = useRef(new Set<string>());
  const handleIndividualCalled = async (ticketKeys: string[]) => {
    for (const key of ticketKeys) ownCalledKeysRef.current.add(key);
    await commitIndividualCalled();
  };
  const getIgnoreTicketKeys = useCallback(() => {
    const keys = new Set(ownCalledKeysRef.current);
    for (const ticket of individualTickets) {
      if (ticket.mine) keys.add(ticket.ticket_key);
    }
    return keys;
  }, [individualTickets]);
  // The phone id is only known after mount: reload once so `mine` ticket states are right.
  useEffect(() => {
    if (!guestClientId || !individualGuest) return;
    void refreshBill();
  }, [guestClientId, individualGuest, refreshBill]);

  /** Live session from bill sync — never keep SSR session id after table reopen. */
  const activeSessionId = liveSessionId ?? sessionId;

  const persistedResult = useMemo(
    () => submittedSplitResult(liveSplit?.result as SplitResult[] | null, submitted),
    [liveSplit?.result, submitted],
  );
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, { vote?: DishFeedbackVote; reasons: DishFeedbackReasonKey[] }>>({});
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(initialFeedbackSubmitted);
  const [feedbackSkipped, setFeedbackSkipped] = useState(initialFeedbackSkipped);
  const [feedbackHydrating, setFeedbackHydrating] = useState(
    () =>
      !!existingSplit &&
      !!activeSessionId &&
      !staffAssisted?.skipFeedback &&
      !initialFeedbackSubmitted &&
      !initialFeedbackSkipped,
  );
  const [customerNifInput, setCustomerNifInput] = useState('');
  const [editingConsumerName, setEditingConsumerName] = useState(false);
  const [callBillBusy, setCallBillBusyState] = useState(false);

  useEffect(() => {
    setCallBillBusy(callBillBusy);
  }, [callBillBusy, setCallBillBusy]);

  const detailLines = useMemo(
    () => checkoutLinesFromOrders(orders, lang, itemCodeByMenuId),
    [orders, lang, itemCodeByMenuId],
  );

  // Individual checkout: `requested` means "someone called", not "this phone is checking out" —
  // the draft machinery must keep treating this phone as editable while it holds no called ticket.
  const draftSplit = useMemo(
    () =>
      individualGuest && liveSplit && liveSplit.status === 'requested'
        ? { ...liveSplit, status: 'confirmed' as const }
        : liveSplit,
    [individualGuest, liveSplit],
  );

  const splitDraft = useBillSplitDraft({
    restaurantId: restaurant.id,
    sessionId: activeSessionId,
    existingSplit: draftSplit,
    continuationSplit: draftSplit,
    collectedPayments,
    total,
    orderLines: splitOrderLines,
    lineSpecs,
    lang,
    guestName,
    submitted,
    persistedResult,
    submitting: callBillBusy,
    byItemEditor: 'guest',
    ...(individualGuest
      ? { individualReadOnlyKeys, discountRate: 0 }
      : {}),
  });

  const { isCallBillBusy, submitCallBill } = useCheckoutRequestSubmit({
    restaurant,
    tableId,
    displayName,
    orders,
    partyMemberCount,
    lastSyncedAt,
    refreshOrders,
    commitOrders,
    splitDraft,
    customerNifInput,
    checkoutRedirectHref,
    onCustomerSubmitSuccess: commitSubmittedCheckout,
    individual: individualGuest
      ? {
          guestClientId,
          readOnlyTicketKeys: individualReadOnlyKeys,
          onCalled: handleIndividualCalled,
        }
      : null,
    onBusyChange: setCallBillBusyState,
    showToast,
    messages: {
      billSyncFailed: t.billSyncFailed,
      billIncomplete: t.billIncomplete,
      splitUnassignedItems: t.splitUnassignedItems,
      splitIncompleteQty: t.splitIncompleteQty,
      splitAmountMismatch: t.splitAmountMismatch,
      nifInvalid: t.nifInvalid,
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
      enabled={individualGuest}
      suppressModal={submitted}
      onSignals={() => void refreshBill()}
      getIgnoreTicketKeys={getIgnoreTicketKeys}
      resolveLineName={resolveLineName}
    />
  );

  /** Individual checkout: the called screen lists only this phone's tickets. */
  const individualMine = useMemo(() => {
    if (!individualGuest || !submitted) return null;
    const results = (liveSplit?.result ?? []) as SplitResult[];
    const mineKeys = new Set(
      individualTickets.filter((ticket) => ticket.mine).map((ticket) => ticket.ticket_key),
    );
    const rows = splitDraft.splitDisplayRows.filter((_, index) => {
      const row = results[index];
      return !!row && mineKeys.has(splitResultTicketKey(row));
    });
    return {
      rows,
      total: Math.round(rows.reduce((sum, row) => sum + row.obligationAmount, 0) * 100) / 100,
    };
  }, [individualGuest, submitted, liveSplit?.result, individualTickets, splitDraft.splitDisplayRows]);

  const [resumeBusy, setResumeBusy] = useState(false);
  /** Guest「恢复点单」: unlock this phone's called tickets, then reload the shared plan. */
  const handleIndividualResume = async () => {
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
        await refreshBill();
        return;
      }
      await refreshBill();
    } finally {
      setResumeBusy(false);
    }
  };

  useEffect(() => {
    if (!checkoutRedirectHref || !submitted) return;
    router.replace(checkoutRedirectHref);
  }, [checkoutRedirectHref, submitted, router]);

  const callBillAmount = useMemo(
    () => customerBillCallAmount({ total, collectedPayments }),
    [total, collectedPayments],
  );
  // Individual checkout offers a single split mode (按菜): select it once so the editor is ready.
  const { splitMode: draftSplitMode, handleSplitModeClick: selectSplitMode } = splitDraft;
  useEffect(() => {
    if (!individualGuest || submitted || callBillBusy || draftSplitMode != null) return;
    selectSplitMode('by_item');
  }, [individualGuest, submitted, callBillBusy, draftSplitMode, selectSplitMode]);

  // Individual checkout: the button amount is what THIS phone claims (not the whole bill).
  const individualDraftAmount = useMemo(() => {
    if (!individualGuest) return null;
    if (splitDraft.splitMode !== 'by_item') return 0;
    const sum = splitDraft.results
      .filter((row) => !individualReadOnlyKeys.has(splitResultTicketKey(row)))
      .reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
    return Math.round(sum * 100) / 100;
  }, [individualGuest, individualReadOnlyKeys, splitDraft.results, splitDraft.splitMode]);
  const callAmountShown = individualDraftAmount ?? callBillAmount;

  const byItemAllocatorLabels = useMemo(
    () => ({
      addConsumer: t.addConsumer,
      namePlaceholder: t.consumerNamePlaceholder,
      typeNewName: t.consumerNameTypeNew,
      wholeLabel: t.qtyWholePlaceholder,
      numLabel: t.qtyNumPlaceholder,
      denLabel: t.qtyDenPlaceholder,
      missingDen: t.qtyMissingDen,
      zeroDen: t.qtyZeroDen,
      improperFraction: t.qtyImproperFraction,
      complete: t.byItemComplete,
      remaining: t.byItemRemaining,
      over: t.byItemOver,
      missingNames: t.byItemMissingNames,
      duplicateNames: t.byItemDuplicateNames,
      unassigned: t.byItemUnassigned,
      invalidQty: t.byItemInvalidQty,
      buffetComplete: t.byItemBuffetComplete,
      buffetShortAdult: t.byItemBuffetShortAdult,
      buffetShortChild: t.byItemBuffetShortChild,
      buffetOverAdult: t.byItemBuffetOverAdult,
      buffetOverChild: t.byItemBuffetOverChild,
      buffetAdultProgress: t.byItemBuffetAdultProgress,
      buffetChildProgress: t.byItemBuffetChildProgress,
      buffetAdultQtyLabel: t.byItemGuestTypeAdult,
      buffetChildQtyLabel: t.byItemGuestTypeChild,
      remove: t.removeConsumer,
      expandDetails: t.byItemExpandDetails,
      collapseDetails: t.byItemCollapseDetails,
      byItemProgress: t.byItemProgress,
    }),
    [t],
  );

  const splitValidationMessage =
    splitDraft.splitValidation.ok
      ? null
      : splitDraft.splitValidation.issue === 'unassigned_items'
        ? t.splitUnassignedItems
        : splitDraft.splitValidation.issue === 'incomplete_qty'
          ? t.splitIncompleteQty
          : t.splitAmountMismatch;

  const collectsCustomerNif = guestBillCollectsCustomerNif(splitDraft.splitMode);
  const customerNifInvalid =
    collectsCustomerNif
    && customerNifInput.trim().length > 0
    && !validatePortugueseNif(customerNifInput);

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
    if (customerNifInvalid) {
      showToast(t.nifInvalid, 'error');
      return;
    }
    if (splitDraft.splitMode && !splitDraft.splitValidation.ok) {
      showToast(splitValidationMessage ?? t.splitAmountMismatch, 'error');
      return;
    }
    void submitCallBill();
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
    if (!submitted || !activeSessionId || staffAssisted?.skipFeedback || initialFeedbackSubmitted || initialFeedbackSkipped) {
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
    staffAssisted,
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

  // Individual sessions render only after a read that carried this phone's id, so the editor
  // never flashes for a phone whose own ticket is already called.
  if (individualGuest && !individualReady) {
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
        total={individualMine ? individualMine.total : total}
        splitRows={individualMine ? individualMine.rows : splitDraft.splitDisplayRows}
        individual={
          individualGuest
            ? {
                hint: t.individualCalledHint,
                resumeLabel: t.individualResume,
                resumeBusyLabel: t.individualResumeBusy,
                resumeBusy,
                onResume: () => void handleIndividualResume(),
              }
            : null
        }
        backHref={backHref}
        backLabel={backLabel}
        onRefreshPage={() => window.location.reload()}
        staffAssisted={staffAssisted}
        showFeedback={!staffAssisted?.skipFeedback && !feedbackSkipped}
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

  // Index 0 is a valid row — never truthiness-check the index.
  const editingCustomAmount = splitDraft.editingCustomAmountIndex != null;
  /** Sole guest bill fixed-CTA yield: custom-amount edit or consumer-name focus. */
  const hideFixedCallCheckout = editingCustomAmount || editingConsumerName;
  // Name edit keeps pb-24 (rail needs bottom air); only custom-amount tightens pad.
  const pagePadClass =
    checkoutGateMessage && !hideFixedCallCheckout
      ? 'pb-40'
      : editingCustomAmount
        ? 'pb-6'
        : 'pb-24';

  return (
    <GuestConsumerNameEditChromeProvider onActiveChange={setEditingConsumerName}>
    {individualNotice}
    <div
      data-editing-custom-amount={editingCustomAmount ? '1' : '0'}
      data-editing-consumer-name={editingConsumerName ? '1' : '0'}
      className={`min-h-screen bg-brand-bg max-w-mobile mx-auto ${pagePadClass}`}
    >
      <CustomerOrderingHeader
        restaurantName={restaurant.name}
        displayName={displayName}
        tableLabel={t.table}
        staffAssisted={staffAssisted}
        subtitle={t.settlement}
        headingSize="bill"
        backLink={{ href: backHref, label: backLabel }}
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
          addPerson: t.addPerson,
          removePerson: t.removePerson,
          splitPaid: t.splitPaid,
          splitPartialPaid: t.splitPartialPaid,
          splitAmountBreakdown: t.splitAmountBreakdown,
        }}
        splitGuidance={getGuestSplitGuidance(lang)}
        individualMode={individualGuest}
        splitMode={splitDraft.splitMode}
        splitLocked={splitDraft.splitLocked}
        submitting={isCallBillBusy}
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
        onEditingCustomAmountValueChange={splitDraft.editCustomAmountDraft}
        onCancelInlineAmountEdit={() => {
          splitDraft.setEditingCustomAmountIndex(null);
          splitDraft.setEditingCustomAmountValue('');
        }}
        onAddCustomPerson={splitDraft.addCustomPerson}
        onRemoveCustomPerson={splitDraft.removeCustomPerson}
      />

      {!submitted && collectsCustomerNif ? (
        <div className="px-4 pb-3">
          <label htmlFor="customer-nif" className="text-brand-text font-medium text-sm block mb-1.5">
            {t.nifLabel}
          </label>
          <input
            id="customer-nif"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={customerNifInput}
            onChange={(e) => setCustomerNifInput(formatPortugueseNif(e.target.value))}
            placeholder={t.nifPlaceholder}
            className={`${customerNifInputClass} ${
              customerNifInvalid
                ? 'border-red-500 focus:ring-red-500/40'
                : 'border-brand-border focus:ring-brand-gold/40'
            }`}
          />
          <p className={`text-[12px] mt-1.5 ${customerNifInvalid ? 'text-red-500' : 'text-brand-text-muted'}`}>
            {customerNifInvalid ? t.nifInvalid : t.nifHint}
          </p>
        </div>
      ) : null}

      {/* Sole guest bill CTA chrome — stay mounted; `hidden` (display:none) while
          custom-amount or consumer-name edit. It is fixed, so flow layout does not
          change, and iOS drops the layer (visibility:hidden left ghost copies). */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-mobile px-4 z-20 space-y-2 ${
          hideFixedCallCheckout ? 'hidden' : ''
        }`}
        aria-hidden={hideFixedCallCheckout || undefined}
      >
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
            hideFixedCallCheckout
            || orderLines.length === 0
            || !activeSessionId
            || isCallBillBusy
            || !guestCountConfirmed
            || !partyCheckoutAllowed
            || (!!splitDraft.splitMode && !splitDraft.splitValidation.ok)
            || customerNifInvalid
            || (individualGuest && !((individualDraftAmount ?? 0) > 0))
          }
        >
          🔔 {t.callBill} — €{callAmountShown.toFixed(2)}
        </Button>
      </div>
    </div>
    </GuestConsumerNameEditChromeProvider>
  );
}
