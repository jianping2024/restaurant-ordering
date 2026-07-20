'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { shouldShowCheckoutSubmitted } from '@/lib/checkout-split-continuation';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import {
  customerBillCallAmount,
  initialPersistedSplitResult,
} from '@/lib/customer-bill-split-display';
import { checkoutLinesFromOrders } from '@/lib/checkout-session-lines';
import { getMessages } from '@/lib/i18n/messages';
import { formatPortugueseNif, validatePortugueseNif } from '@/lib/pt-nif';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import { isBillGuestCountConfirmed } from '@/lib/table-guest-count';
import { isPartyMemberCountAllowedForCheckout } from '@/lib/table-party-groups';
import { useCheckoutRequestSubmit } from '@/lib/use-checkout-request-submit';
import { CustomerOrderingHeader } from '@/components/menu/CustomerOrderingHeader';
import { useBillOrders } from '@/lib/use-bill-orders';
import { useBillSplitDraft } from '@/lib/use-bill-split-draft';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import type { BillSplit, DishFeedbackVote, Order, SessionStatus, SplitResult } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { staffAssistedReturnLabel } from '@/lib/i18n/staff-assisted-messages';
import { showToast } from '@/components/ui/Toast';
import { BillDetailsSection } from '@/components/menu/BillDetailsSection';
import { BillSplitPanel } from '@/components/menu/BillSplitPanel';
import { BillCheckoutSubmittedScreen } from '@/components/menu/BillCheckoutSubmittedScreen';
import { customerNifInputClass } from '@/components/menu/customer-form-input-styles';

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
  initialPartyMemberCount?: number;
}

const FEEDBACK_REASON_KEYS = ['taste', 'temp', 'slow', 'mismatch', 'other'] as const;
type FeedbackReasonKey = (typeof FEEDBACK_REASON_KEYS)[number];

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
  initialPartyMemberCount = 0,
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

  const [continuationSplit] = useState<BillSplit | null>(existingSplit);
  const collectedPayments = initialCollectedPayments;
  const checkoutSubmittedInitially = shouldShowCheckoutSubmitted(existingSplit, sessionStatus);
  const [submitted, setSubmitted] = useState(checkoutSubmittedInitially);
  const [persistedResult, setPersistedResult] = useState<SplitResult[] | null>(() =>
    initialPersistedSplitResult(existingSplit?.result as SplitResult[] | null, checkoutSubmittedInitially),
  );
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, { vote?: DishFeedbackVote; reasons: FeedbackReasonKey[] }>>({});
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(initialFeedbackSubmitted);
  const [feedbackSkipped, setFeedbackSkipped] = useState(initialFeedbackSkipped);
  const [feedbackHydrating, setFeedbackHydrating] = useState(
    () => !!existingSplit && !!sessionId && !staffAssisted?.skipFeedback && !initialFeedbackSubmitted && !initialFeedbackSkipped,
  );
  const [customerNifInput, setCustomerNifInput] = useState('');
  const [callBillBusy, setCallBillBusy] = useState(false);

  const {
    orders,
    partyMemberCount,
    orderLines,
    lineSpecs,
    total,
    refreshOrders,
    commitOrders,
    lastSyncedAt,
  } = useBillOrders(initialOrders, {
    slug: restaurant.slug,
    tableId,
    initialPartyMemberCount,
    enabled: !submitted,
  });

  const detailLines = useMemo(
    () => checkoutLinesFromOrders(orders, itemCodeByMenuId),
    [orders, itemCodeByMenuId],
  );

  const splitDraft = useBillSplitDraft({
    restaurantId: restaurant.id,
    sessionId,
    existingSplit,
    continuationSplit,
    collectedPayments,
    total,
    orderLines,
    lineSpecs,
    wholeTableLabel: t.totalLabel,
    guestName,
    submitted,
    persistedResult,
    submitting: callBillBusy,
  });

  const { isCallBillBusy, submitCallBill } = useCheckoutRequestSubmit({
    restaurant,
    tableId,
    displayName,
    sessionId,
    orders,
    partyMemberCount,
    lastSyncedAt,
    refreshOrders,
    commitOrders,
    splitDraft,
    customerNifInput,
    checkoutRedirectHref,
    onSubmitSuccess: (result) => {
      setPersistedResult(result);
    },
    onCustomerSubmitSuccess: () => {
      setSubmitted(true);
    },
    onBusyChange: setCallBillBusy,
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
    },
  });

  useEffect(() => {
    if (!checkoutRedirectHref || !submitted) return;
    router.replace(checkoutRedirectHref);
  }, [checkoutRedirectHref, submitted, router]);

  const callBillAmount = useMemo(
    () => customerBillCallAmount({
      total,
      splitMode: splitDraft.splitMode,
      resultRows: splitDraft.results,
      collectedPayments,
    }),
    [total, splitDraft.splitMode, splitDraft.results, collectedPayments],
  );

  const byItemAllocatorLabels = useMemo(
    () => ({
      addConsumer: t.addConsumer,
      namePlaceholder: t.consumerNamePlaceholder,
      wholePlaceholder: t.qtyWholePlaceholder,
      numPlaceholder: t.qtyNumPlaceholder,
      denPlaceholder: t.qtyDenPlaceholder,
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

  const customerNifInvalid =
    customerNifInput.trim().length > 0 && !validatePortugueseNif(customerNifInput);

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
    const dedup = new Map<string, { menu_item_id: string; order_id: string; name: string; emoji: string; qty: number }>();
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
          name: item.name || item.name_pt,
          emoji: item.emoji,
          qty: item.qty,
        });
      });
    return Array.from(dedup.values());
  }, [orderLines, orders]);

  const feedbackReasonLabels: Record<FeedbackReasonKey, string> = {
    taste: t.reasonTaste,
    temp: t.reasonTemp,
    slow: t.reasonSlow,
    mismatch: t.reasonMismatch,
    other: t.reasonOther,
  };

  const selectedFeedbackCount = Object.values(feedbackDraft).filter((entry) => !!entry.vote).length;

  useEffect(() => {
    if (!submitted || !sessionId || staffAssisted?.skipFeedback || initialFeedbackSubmitted || initialFeedbackSkipped) return;
    setFeedbackHydrating(true);
    const supabase = createClient();
    const syncFeedbackState = async () => {
      await supabase
        .from('feedback_sessions')
        .upsert({
          restaurant_id: restaurant.id,
          session_id: sessionId,
          source: 'bill_success',
          shown_at: new Date().toISOString(),
        }, { onConflict: 'session_id' });

      const { data } = await supabase
        .from('dish_feedback')
        .select('menu_item_id, vote, reasons')
        .eq('session_id', sessionId);

      if (!data?.length) return;
      const nextDraft: Record<string, { vote?: DishFeedbackVote; reasons: FeedbackReasonKey[] }> = {};
      data.forEach((row) => {
        const reasons = Array.isArray(row.reasons)
          ? row.reasons.filter((reason): reason is FeedbackReasonKey => FEEDBACK_REASON_KEYS.includes(reason as FeedbackReasonKey))
          : [];
        nextDraft[row.menu_item_id] = {
          vote: row.vote as DishFeedbackVote,
          reasons,
        };
      });
      setFeedbackDraft(nextDraft);
      setFeedbackSubmitted(true);
    };
    void syncFeedbackState().finally(() => setFeedbackHydrating(false));
  }, [submitted, sessionId, restaurant.id, staffAssisted, initialFeedbackSubmitted, initialFeedbackSkipped]);

  const setVote = (menuItemId: string, vote: DishFeedbackVote) => {
    setFeedbackDraft((prev) => ({
      ...prev,
      [menuItemId]: {
        vote,
        reasons: vote === 'down' ? (prev[menuItemId]?.reasons || []) : [],
      },
    }));
  };

  const toggleReason = (menuItemId: string, reason: FeedbackReasonKey) => {
    setFeedbackDraft((prev) => {
      const existing = prev[menuItemId] || { vote: 'down' as DishFeedbackVote, reasons: [] as FeedbackReasonKey[] };
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
    if (!sessionId || feedbackSkipped || feedbackSubmitting) return;
    setFeedbackSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('feedback_sessions')
        .upsert(
          {
            restaurant_id: restaurant.id,
            session_id: sessionId,
            source: 'bill_success',
            shown_at: new Date().toISOString(),
            skipped_at: new Date().toISOString(),
          },
          { onConflict: 'session_id' },
        );
      if (error) {
        showToast(t.actionFailed);
        return;
      }
      setFeedbackSkipped(true);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!sessionId || selectedFeedbackCount === 0) return;
    setFeedbackSubmitting(true);
    try {
      const supabase = createClient();
      const payload = reviewableItems
        .map((item) => {
          const draft = feedbackDraft[item.menu_item_id];
          if (!draft?.vote) return null;
          return {
            restaurant_id: restaurant.id,
            session_id: sessionId,
            order_id: item.order_id,
            menu_item_id: item.menu_item_id,
            vote: draft.vote,
            reasons: draft.vote === 'down' ? draft.reasons : [],
          };
        })
        .filter((row): row is NonNullable<typeof row> => !!row);

      if (payload.length === 0) return;

      await supabase
        .from('dish_feedback')
        .upsert(payload, { onConflict: 'session_id,menu_item_id' });

      await supabase
        .from('feedback_sessions')
        .upsert({
          restaurant_id: restaurant.id,
          session_id: sessionId,
          source: 'bill_success',
          shown_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          skipped_at: null,
        }, { onConflict: 'session_id' });

      setFeedbackSubmitted(true);
      setFeedbackSkipped(false);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  if (submitted) {
    return (
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
        total={total}
        splitRows={splitDraft.splitDisplayRows}
        backHref={backHref}
        backLabel={backLabel}
        onRefreshPage={() => window.location.reload()}
        staffAssisted={staffAssisted}
        showFeedback={!staffAssisted?.skipFeedback && !feedbackSkipped}
        reviewableItems={reviewableItems}
        feedbackDraft={feedbackDraft}
        feedbackReasonLabels={feedbackReasonLabels}
        feedbackReasonKeys={FEEDBACK_REASON_KEYS}
        feedbackHydrating={feedbackHydrating}
        feedbackSubmitted={feedbackSubmitted}
        feedbackSubmitting={feedbackSubmitting}
        selectedFeedbackCount={selectedFeedbackCount}
        onVote={setVote}
        onToggleReason={toggleReason}
        onSkipFeedback={() => void handleSkipFeedback()}
        onSubmitFeedback={() => void handleSubmitFeedback()}
      />
    );
  }

  return (
    <div
      className={`min-h-screen bg-brand-bg max-w-mobile mx-auto ${
        checkoutGateMessage ? 'pb-40' : 'pb-24'
      }`}
    >
      <CustomerOrderingHeader
        restaurantName={restaurant.name}
        displayName={displayName}
        tableLabel={t.table}
        staffAssisted={staffAssisted}
        subtitle={t.settlement}
        headingSize="bill"
        backLink={staffAssisted ? null : { href: backHref, label: backLabel }}
      />

      <BillDetailsSection
        title={t.details}
        totalLabel={t.total}
        lines={detailLines}
        total={total}
      />

      <BillSplitPanel
        lang={lang}
        copy={{
          splitMode: t.splitMode,
          even: t.even,
          byItem: t.byItem,
          custom: t.custom,
          splitPlanLocked: t.splitPlanLocked,
          splitOptionalHint: t.splitOptionalHint,
          people: t.people,
          splitResult: t.splitResult,
          addPerson: t.addPerson,
          splitPaid: t.splitPaid,
          splitPartialPaid: t.splitPartialPaid,
          splitAmountBreakdown: t.splitAmountBreakdown,
        }}
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
        orderLines={orderLines}
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

      {!submitted ? (
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
            || !sessionId
            || isCallBillBusy
            || !guestCountConfirmed
            || !partyCheckoutAllowed
            || (!!splitDraft.splitMode && !splitDraft.splitValidation.ok)
            || customerNifInvalid
          }
        >
          🔔 {t.callBill} — €{callBillAmount.toFixed(2)}
        </Button>
      </div>
    </div>
  );
}
