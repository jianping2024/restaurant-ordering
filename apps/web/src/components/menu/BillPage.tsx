'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { validateSplitDraft } from '@/lib/bill-split-draft';
import {
  isCheckoutSplitLocked,
  lockedByItemLineKeys,
  shouldShowCheckoutSubmitted,
} from '@/lib/checkout-split-continuation';
import { deriveBillView, isBillOrdersComplete } from '@/lib/customer-bill-sync';
import { requestCustomerBillContext } from '@/lib/request-customer-context';
import { formatOrderItemQuantityLabel, orderListGuestLabelsFromLang } from '@/lib/order-list-display';
import { getMessages } from '@/lib/i18n/messages';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import { normalizeDecimalInput as normalizeAmountInput } from '@/lib/number-input';
import { formatPortugueseNif, normalizePortugueseNif, validatePortugueseNif } from '@/lib/pt-nif';
import { requestCheckoutConfirmPayment } from '@/lib/request-checkout-confirm-payment';
import { requestCheckoutRequest } from '@/lib/request-checkout-request';
import { useBillOrders } from '@/lib/use-bill-orders';
import { useByItemSplitState } from '@/lib/use-by-item-split-state';
import { requestOrderReceiptPrintQuiet } from '@/lib/request-order-receipt-print';
import { localizeSplitPersonName } from '@/lib/split-person-label';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import type { BillSplit, DishFeedbackVote, Order, OrderItem, SessionStatus, SplitMode, SplitResult } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { showToast } from '@/components/ui/Toast';
import { ByItemSplitSection } from '@/components/menu/ByItemSplitSection';

interface Props {
  restaurant: { id: string; name: string; slug: string };
  tableId: string;
  displayName: string;
  orders: Order[];
  sessionId: string | null;
  sessionStatus: SessionStatus;
  existingSplit: BillSplit | null;
  hasCollectedPayments?: boolean;
  returnPath?: string | null;
  initialFeedbackSubmitted?: boolean;
  initialFeedbackSkipped?: boolean;
  itemCodeByMenuId?: Record<string, string>;
}

interface PersonAmount {
  name: string;
  amount: number;
}

interface SplitPersonSlot {
  id: string;
  name: string;
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
  hasCollectedPayments = false,
  returnPath,
  initialFeedbackSubmitted = false,
  initialFeedbackSkipped = false,
  itemCodeByMenuId = {},
}: Props) {
  const isWaiterFlow = !!returnPath;
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).bill;
  const backHref = returnPath || `/${restaurant.slug}/menu?table_id=${encodeURIComponent(tableId)}`;
  const backLabel = isWaiterFlow ? t.backToWaiter : t.backToMenu;
  const guestName = (n: number) => `${t.guest} ${n}`;
  const lineQtyLabel = (item: Pick<OrderItem, 'kind' | 'qty' | 'adult_count' | 'child_count'>) =>
    formatOrderItemQuantityLabel(item, {
      headcountStyle: 'localized',
      guestLabels: orderListGuestLabelsFromLang(lang),
    });
  const initialSplitMode: SplitMode | null = (() => {
    if (!existingSplit) return null;
    if (existingSplit.split_mode === 'custom' && existingSplit.result?.length === 1) return null;
    return existingSplit.split_mode;
  })();
  const [continuationSplit, setContinuationSplit] = useState<BillSplit | null>(existingSplit);
  const [collectedLedgerActive, setCollectedLedgerActive] = useState(hasCollectedPayments);
  const [splitMode, setSplitMode] = useState<SplitMode | null>(initialSplitMode);
  const [personCount, setPersonCount] = useState(() => {
    if (existingSplit?.split_mode === 'even' && existingSplit.persons?.length) {
      return existingSplit.persons.length;
    }
    return 2;
  });
  const [splitPeople, setSplitPeople] = useState<SplitPersonSlot[]>(() => {
    if (existingSplit?.persons?.length) {
      return existingSplit.persons.map((person, idx) => ({
        id: `p${idx + 1}`,
        name: person.name,
      }));
    }
    return [
      { id: 'p1', name: guestName(1) },
      { id: 'p2', name: guestName(2) },
    ];
  });
  const [customAmounts, setCustomAmounts] = useState<PersonAmount[]>(() => {
    if (existingSplit?.split_mode === 'custom' && existingSplit.result?.length) {
      return existingSplit.result.map((row) => ({ name: row.name, amount: row.amount }));
    }
    return [
      { name: guestName(1), amount: 0 },
      { name: guestName(2), amount: 0 },
    ];
  });
  const [submitted, setSubmitted] = useState(
    shouldShowCheckoutSubmitted(existingSplit, sessionStatus),
  );
  const [submitting, setSubmitting] = useState(false);
  const [persistedResult, setPersistedResult] = useState<SplitResult[] | null>((existingSplit?.result as SplitResult[] | null) || null);
  const [persistedSplitId, setPersistedSplitId] = useState<string | null>(existingSplit?.id || null);
  const [personPayProcessingIdx, setPersonPayProcessingIdx] = useState<number | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, { vote?: DishFeedbackVote; reasons: FeedbackReasonKey[] }>>({});
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(initialFeedbackSubmitted);
  const [feedbackSkipped, setFeedbackSkipped] = useState(initialFeedbackSkipped);
  const [feedbackHydrating, setFeedbackHydrating] = useState(() => !!existingSplit && !!sessionId && !returnPath && !initialFeedbackSubmitted && !initialFeedbackSkipped);
  const [customerNifInput, setCustomerNifInput] = useState('');
  const {
    orders,
    orderLines,
    lineSpecs,
    total,
    isSyncing,
    refreshOrders,
    commitOrders,
    syncOrders,
  } = useBillOrders(initialOrders, { slug: restaurant.slug, tableId });

  useEffect(() => {
    if (!submitted || !sessionId) return;

    let cancelled = false;
    const pollCheckoutResumed = async () => {
      const ctx = await requestCustomerBillContext(restaurant.slug, tableId);
      if (cancelled || !ctx) return;
      if (ctx.active_session?.status === 'open' && ctx.existing_split?.status === 'confirmed') {
        setSubmitted(false);
        setContinuationSplit(ctx.existing_split);
        setCollectedLedgerActive(ctx.has_collected_payments);
        if (ctx.existing_split.split_mode) {
          setSplitMode(ctx.existing_split.split_mode);
        }
        await syncOrders();
        return;
      }
      if (ctx.active_session?.status === 'open' && !ctx.existing_split) {
        setSubmitted(false);
        setSplitMode(null);
        setContinuationSplit(null);
        setCollectedLedgerActive(false);
        setPersistedResult(null);
        setPersistedSplitId(null);
        await syncOrders();
      }
    };

    void pollCheckoutResumed();
    const timer = window.setInterval(() => void pollCheckoutResumed(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [submitted, sessionId, restaurant.slug, tableId, syncOrders]);

  const [editingSplitNameIndex, setEditingSplitNameIndex] = useState<number | null>(null);
  const [editingSplitNameValue, setEditingSplitNameValue] = useState('');
  const [editingCustomAmountIndex, setEditingCustomAmountIndex] = useState<number | null>(null);
  const [editingCustomAmountValue, setEditingCustomAmountValue] = useState('');

  const syncNameAcrossModes = (index: number, name: string) => {
    setSplitPeople((prev) => prev.map((person, idx) => (idx === index ? { ...person, name } : person)));
    setCustomAmounts((prev) => prev.map((person, idx) => (idx === index ? { ...person, name } : person)));
  };

  const startInlineRename = (index: number) => {
    const current = splitPeople[index];
    if (!current) return;
    if (splitLocked && paidPersonNames.has(current.name.trim().toLowerCase())) return;
    setEditingSplitNameIndex(index);
    setEditingSplitNameValue(current.name);
  };

  const commitInlineRename = (index: number) => {
    const normalized = editingSplitNameValue.trim();
    if (splitMode === 'by_item') {
      const oldName = results[index]?.name;
      if (oldName && normalized) {
        if (splitLocked && paidPersonNames.has(oldName.trim().toLowerCase())) {
          setEditingSplitNameIndex(null);
          setEditingSplitNameValue('');
          return;
        }
        renameByItemConsumer(oldName, normalized);
      }
    } else {
      syncNameAcrossModes(index, normalized || guestName(index + 1));
    }
    setEditingSplitNameIndex(null);
    setEditingSplitNameValue('');
  };

  const updateCustomAmount = (index: number, rawValue: string) => {
    const parsed = Number(rawValue);
    const safeValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setCustomAmounts((prev) => {
      const othersTotal = prev.reduce((sum, person, idx) => (idx === index ? sum : sum + person.amount), 0);
      const maxAllowed = Math.max(0, total - othersTotal);
      const nextValue = Math.min(safeValue, maxAllowed);
      return prev.map((person, idx) => (idx === index ? { ...person, amount: nextValue } : person));
    });
  };

  const startInlineAmountEdit = (index: number) => {
    setEditingCustomAmountIndex(index);
    setEditingCustomAmountValue(String(customAmounts[index]?.amount ?? 0));
  };

  const commitInlineAmountEdit = (index: number) => {
    updateCustomAmount(index, editingCustomAmountValue || '0');
    setEditingCustomAmountIndex(null);
    setEditingCustomAmountValue('');
  };

  const {
    byItemAllocations,
    setByItemAllocations,
    consumerRoster,
    rememberConsumerName,
    parsedByItemAllocations,
    byItemProgress,
    renameByItemConsumer,
    buildPersonsForSubmit,
  } = useByItemSplitState({ splitMode, lineSpecs, existingSplit: continuationSplit });

  const splitLocked = useMemo(
    () => isCheckoutSplitLocked(continuationSplit, collectedLedgerActive, sessionStatus),
    [continuationSplit, collectedLedgerActive, sessionStatus],
  );
  const lockedLineKeys = useMemo(
    () => (splitLocked ? lockedByItemLineKeys(continuationSplit) : new Set<string>()),
    [splitLocked, continuationSplit],
  );
  const paidPersonNames = useMemo(
    () =>
      new Set(
        (continuationSplit?.result ?? [])
          .filter((row) => row.paid)
          .map((row) => row.name.trim().toLowerCase()),
      ),
    [continuationSplit?.result],
  );

  const splitDraftInput = useMemo(
    () => ({
      splitMode,
      total,
      orderLines,
      lineSpecs,
      personCount,
      splitPeople,
      customAmounts,
      parsedByItemAllocations,
      wholeTableLabel: t.totalLabel,
    }),
    [
      splitMode,
      total,
      orderLines,
      lineSpecs,
      personCount,
      splitPeople,
      customAmounts,
      parsedByItemAllocations,
      t.totalLabel,
    ],
  );

  const { results: computedResults, validation: splitValidation } = useMemo(
    () => validateSplitDraft(splitDraftInput),
    [splitDraftInput],
  );

  const results = persistedResult || computedResults;

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
      byItemProgress: t.byItemProgress,
    }),
    [t],
  );

  const splitValidationMessage =
    splitValidation.ok
      ? null
      : splitValidation.issue === 'unassigned_items'
        ? t.splitUnassignedItems
        : splitValidation.issue === 'incomplete_qty'
          ? t.splitIncompleteQty
          : t.splitAmountMismatch;

  const customerNifInvalid =
    customerNifInput.trim().length > 0 && !validatePortugueseNif(customerNifInput);

  const handleSplitModeClick = async (mode: SplitMode) => {
    if (isSyncing || submitting || splitLocked) return;
    if (splitMode === mode) {
      setSplitMode(null);
      return;
    }
    const fresh = await syncOrders();
    if (!fresh) {
      showToast(t.billSyncFailed, 'error');
      return;
    }
    setSplitMode(mode);
  };

  // 呼叫结账
  const handleCallBill = async () => {
    if (customerNifInvalid) {
      showToast(t.nifInvalid, 'error');
      return;
    }
    if (splitMode && !splitValidation.ok) {
      showToast(splitValidationMessage ?? t.splitAmountMismatch, 'error');
      return;
    }
    setSubmitting(true);
    try {
      const displayedBefore = orders;
      const fresh = await refreshOrders();
      if (!fresh) {
        showToast(t.billSyncFailed, 'error');
        return;
      }
      if (!isBillOrdersComplete(displayedBefore, fresh)) {
        commitOrders(fresh);
        showToast(t.billIncomplete, 'error');
        return;
      }
      commitOrders(fresh);

      const freshView = deriveBillView(fresh);
      const { results: submitResults, validation } = validateSplitDraft({
        ...splitDraftInput,
        total: freshView.total,
        orderLines: freshView.orderLines,
        lineSpecs: freshView.lineSpecs,
      });
      if (!validation.ok) {
        const message =
          validation.issue === 'unassigned_items'
            ? t.splitUnassignedItems
            : validation.issue === 'incomplete_qty'
              ? t.splitIncompleteQty
              : t.splitAmountMismatch;
        showToast(message, 'error');
        return;
      }

      const persons = splitMode === 'by_item'
        ? buildPersonsForSubmit()
        : splitPeople.slice(0, submitResults.length).map((person, idx) => ({
            name: submitResults[idx]?.name ?? person.name,
          }));

      const requestResult = await requestCheckoutRequest({
        slug: restaurant.slug,
        tableId,
        splitMode,
        persons,
        result: submitResults,
        customerNif: normalizePortugueseNif(customerNifInput) || null,
      });
      if (!requestResult.ok) {
        const message =
          requestResult.error === 'invalid_nif'
            ? t.nifInvalid
            : requestResult.error === 'split_mode_locked' || requestResult.error === 'locked_allocation_changed'
              ? t.splitPlanLocked
              : t.actionFailed;
        showToast(message, 'error');
        return;
      }

      setContinuationSplit(null);

      setPersistedSplitId(requestResult.bill_split_id);
      setPersistedResult(requestResult.result);
      setSubmitted(true);
      if (sessionId) {
        requestOrderReceiptPrintQuiet({
          slug: restaurant.slug,
          tableId,
          sessionId,
          receiptVariant: 'pre_bill',
        });
      }
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPersonPaidFromWaiter = async (rowIndex: number) => {
    if (!persistedSplitId) {
      showToast(t.actionFailed, 'error');
      return;
    }
    const row = results[rowIndex];
    if (!row || row.paid) return;
    setPersonPayProcessingIdx(rowIndex);
    try {
      const outcome = await requestCheckoutConfirmPayment({
        slug: restaurant.slug,
        billSplitId: persistedSplitId,
        personIndex: rowIndex,
      });
      if (!outcome.ok) {
        showToast(t.actionFailed, 'error');
        return;
      }

      setPersistedResult(outcome.result);
      if (outcome.all_paid) router.refresh();
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      setPersonPayProcessingIdx(null);
    }
  };

  const reviewableItems = useMemo(() => {
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
          order_id: item.order_id,
          name: item.name || item.name_pt,
          emoji: item.emoji,
          qty: item.qty,
        });
      });
    return Array.from(dedup.values());
  }, [orderLines]);

  const feedbackReasonLabels: Record<FeedbackReasonKey, string> = {
    taste: t.reasonTaste,
    temp: t.reasonTemp,
    slow: t.reasonSlow,
    mismatch: t.reasonMismatch,
    other: t.reasonOther,
  };

  const selectedFeedbackCount = Object.values(feedbackDraft).filter((entry) => !!entry.vote).length;

  useEffect(() => {
    if (!submitted || !sessionId || !!returnPath || initialFeedbackSubmitted || initialFeedbackSkipped) return;
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
  }, [submitted, sessionId, restaurant.id, returnPath, initialFeedbackSubmitted, initialFeedbackSkipped]);

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
      <div className="min-h-screen bg-brand-bg max-w-mobile mx-auto flex items-center justify-center p-4">
        <div className="text-center w-full max-w-sm">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="font-heading text-3xl text-brand-gold mb-2">{isWaiterFlow ? (lang === 'zh' ? '结账收款' : lang === 'en' ? 'Checkout collection' : 'Recebimento') : t.notified}</h2>
          <p className="text-brand-text-muted text-sm">{isWaiterFlow ? (lang === 'zh' ? '请逐位确认收款' : lang === 'en' ? 'Please confirm payment person by person' : 'Confirme o pagamento por pessoa') : t.comingSoon}</p>
          <p className="text-brand-gold font-heading text-2xl mt-6">
            {t.totalLabel} €{total.toFixed(2)}
          </p>
          {(splitMode || isWaiterFlow) && (
            <div className="mt-6 bg-brand-card border border-brand-border rounded-xl overflow-hidden text-left">
              <p className="px-4 py-2 text-[13px] text-brand-text-muted border-b border-brand-border">{t.splitResult}</p>
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-brand-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-brand-text text-sm">{localizeSplitPersonName(r.name, lang)}</span>
                    {r.paid && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full mesa-badge-success">
                        {lang === 'zh' ? '已收款' : lang === 'en' ? 'Paid' : 'Pago'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-brand-gold font-medium">€{r.amount.toFixed(2)}</span>
                    {returnPath && (
                      <button
                        type="button"
                        onClick={() => handleConfirmPersonPaidFromWaiter(i)}
                        disabled={!persistedSplitId || !!r.paid || personPayProcessingIdx === i}
                        className="text-[11px] px-2 py-1 rounded-md mesa-badge-success border hover:bg-emerald-500/26 disabled:opacity-50"
                      >
                        {personPayProcessingIdx === i
                          ? (lang === 'zh' ? '处理中...' : lang === 'en' ? 'Processing...' : 'Processando...')
                          : (lang === 'zh' ? '确认收款' : lang === 'en' ? 'Confirm paid' : 'Confirmar pagamento')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6">
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-xl border border-brand-border px-4 py-2 text-sm text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              ← {backLabel}
            </Link>
          </div>
          {!returnPath && !feedbackSkipped && (
            <div className="mt-6 bg-brand-card border border-brand-border rounded-xl p-4 text-left">
              <h3 className="text-brand-text font-medium">{t.feedbackTitle}</h3>
              <p className="text-brand-text-muted text-[13px] mt-1">{t.feedbackHint}</p>
              {reviewableItems.length === 0 ? (
                <p className="mt-3 text-[13px] text-brand-text-muted">{t.noFeedbackItems}</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {reviewableItems.map((item) => {
                    const draft = feedbackDraft[item.menu_item_id];
                    const reasons = draft?.reasons || [];
                    return (
                      <div key={item.menu_item_id} className="rounded-lg border border-brand-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-brand-text">{item.emoji} {item.name} × {item.qty}</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setVote(item.menu_item_id, 'up')}
                              className={`text-[13px] px-2.5 py-1 rounded-full border transition-colors ${
                                draft?.vote === 'up'
                                  ? 'mesa-badge-success'
                                  : 'border-brand-border text-brand-text-muted hover:text-brand-text'
                              }`}
                            >
                              👍 {t.thumbsUp}
                            </button>
                            <button
                              type="button"
                              onClick={() => setVote(item.menu_item_id, 'down')}
                              className={`text-[13px] px-2.5 py-1 rounded-full border transition-colors ${
                                draft?.vote === 'down'
                                  ? 'mesa-badge-danger'
                                  : 'border-brand-border text-brand-text-muted hover:text-brand-text'
                              }`}
                            >
                              👎 {t.thumbsDown}
                            </button>
                          </div>
                        </div>
                        {draft?.vote === 'down' && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {FEEDBACK_REASON_KEYS.map((reason) => (
                              <button
                                key={reason}
                                type="button"
                                onClick={() => toggleReason(item.menu_item_id, reason)}
                                className={`text-[13px] px-2 py-0.5 rounded-full border ${
                                  reasons.includes(reason)
                                    ? 'mesa-badge-warning'
                                    : 'border-brand-border text-brand-text-muted hover:text-brand-text'
                                }`}
                              >
                                {feedbackReasonLabels[reason]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {feedbackSubmitted && (
                <p className="mt-3 text-[13px] text-brand-text">{t.feedbackThanks}</p>
              )}

              {!feedbackHydrating && !feedbackSubmitted && reviewableItems.length > 0 && (
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleSkipFeedback()}
                    loading={feedbackSubmitting}
                    disabled={feedbackSubmitting}
                  >
                    {t.feedbackSkip}
                  </Button>
                  <Button
                    onClick={() => void handleSubmitFeedback()}
                    loading={feedbackSubmitting}
                    disabled={feedbackSubmitting || selectedFeedbackCount === 0}
                  >
                    {t.feedbackSubmit}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg max-w-mobile mx-auto pb-24">
      {/* 顶部 */}
      <header className="px-4 py-5 border-b border-brand-border">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl text-brand-gold">{restaurant.name}</h1>
          <LanguageSwitcher compact />
        </div>
        <div className="mt-2">
          <Link
            href={backHref}
            className="text-[13px] text-brand-text-muted hover:text-brand-gold transition-colors"
          >
            ← {backLabel}
          </Link>
        </div>
        <p className="text-brand-text-muted text-sm">{t.table} {displayName} — {t.settlement}</p>
      </header>

      {/* 账单明细 */}
      <div className="px-4 py-4">
        <h2 className="text-brand-text font-medium mb-3">{t.details}</h2>
        <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
          {orderLines.map((item) => {
            const itemCode = resolveMenuItemCode(item, itemCodeByMenuId);
            return (
            <div key={item.key} className="flex items-center justify-between px-4 py-3 border-b border-brand-border last:border-0 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                <span>{item.emoji}</span>
                {itemCode && (
                  <span className="font-mono text-[11px] text-brand-gold tabular-nums shrink-0">[{itemCode}]</span>
                )}
                <span className="text-brand-text text-sm">{item.name || item.name_pt}</span>
                <span className="text-brand-text-muted text-[13px]">{lineQtyLabel(item)}</span>
              </div>
              <span className="text-brand-gold text-sm flex-shrink-0">€{(item.price * item.qty).toFixed(2)}</span>
            </div>
            );
          })}
          <div className="flex items-center justify-between px-4 py-3 bg-brand-border/30">
            <span className="text-brand-text font-medium">{t.total}</span>
            <span className="font-heading text-xl text-brand-gold">€{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 分单模式选择 */}
      <div className="px-4 py-4">
        <h2 className="text-brand-text font-medium mb-3">{t.splitMode}</h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {([
            ['even', t.even],
            ['by_item', t.byItem],
            ['custom', t.custom],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              disabled={isSyncing || submitting || splitLocked}
              onClick={() => void handleSplitModeClick(mode)}
              className={`py-2.5 rounded-xl text-sm transition-all ${
                splitMode === mode
                  ? 'bg-brand-gold text-brand-on-gold font-semibold'
                  : 'bg-brand-card border border-brand-border text-brand-text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {splitLocked && (
          <p className="text-brand-text-muted text-[13px] mb-2">{t.splitPlanLocked}</p>
        )}
        {!splitMode && !splitLocked && (
          <p className="text-brand-text-muted text-[13px] mb-2">
            {t.splitOptionalHint}
          </p>
        )}

        {/* 人数选择（均摊）*/}
        {splitMode === 'even' && (
          <div className="flex items-center gap-4 mb-4">
            <span className="text-brand-text-muted text-sm">{t.people}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={splitLocked}
                onClick={() => {
                  const n = Math.max(2, personCount - 1);
                  setPersonCount(n);
                  setSplitPeople((prev) => {
                    const next = prev.slice(0, n);
                    setCustomAmounts((customPrev) => {
                      const cut = customPrev.slice(0, n);
                      return cut.map((row, idx) => ({ ...row, name: next[idx]?.name || row.name }));
                    });
                    return next;
                  });
                }}
                className="w-8 h-8 rounded-full bg-brand-border text-brand-text flex items-center justify-center"
              >−</button>
              <span className="font-heading text-xl text-brand-gold">{personCount}</span>
              <button
                type="button"
                disabled={splitLocked}
                onClick={() => {
                  const n = Math.min(20, personCount + 1);
                  setPersonCount(n);
                  setSplitPeople((prev) => {
                    if (prev.length >= n) return prev.slice(0, n);
                    const next = [...prev];
                    for (let i = prev.length; i < n; i += 1) {
                      next.push({ id: `p${i + 1}`, name: guestName(i + 1) });
                    }
                    setCustomAmounts((customPrev) => {
                      const merged = [...customPrev];
                      while (merged.length < n) {
                        const idx = merged.length;
                        merged.push({ name: next[idx].name, amount: 0 });
                      }
                      return merged.slice(0, n).map((row, idx) => ({ ...row, name: next[idx].name }));
                    });
                    return next;
                  });
                }}
                className="w-8 h-8 rounded-full bg-brand-border text-brand-text flex items-center justify-center"
              >+</button>
            </div>
          </div>
        )}

        {/* 按菜分配 */}
        {splitMode === 'by_item' && (
          <ByItemSplitSection
            lang={lang}
            lineSpecs={lineSpecs}
            orderLines={orderLines}
            byItemAllocations={byItemAllocations}
            consumerRoster={consumerRoster}
            labels={byItemAllocatorLabels}
            itemCodeByMenuId={itemCodeByMenuId}
            progress={byItemProgress}
            lockedLineKeys={lockedLineKeys}
            onAllocationChange={(key, rows) => {
              if (lockedLineKeys.has(key)) return;
              setByItemAllocations((prev) => ({ ...prev, [key]: rows }));
            }}
            onRememberConsumerName={rememberConsumerName}
          />
        )}

      </div>

      {/* 分单结果 */}
      <div className="px-4 py-4">
        <h2 className="text-brand-text font-medium mb-3">{t.splitResult}</h2>
        <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
          {results.map((r, i) => {
            const rowPaid = splitLocked && paidPersonNames.has(r.name.trim().toLowerCase());
            return (
            <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-brand-border last:border-0">
              {splitMode && (splitMode === 'even' || splitMode === 'by_item' || splitMode === 'custom') ? (
                editingSplitNameIndex === i ? (
                  <input
                    type="text"
                    autoFocus
                    value={editingSplitNameValue}
                    onChange={(e) => setEditingSplitNameValue(e.target.value)}
                    onBlur={() => commitInlineRename(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitInlineRename(i);
                      }
                      if (e.key === 'Escape') {
                        setEditingSplitNameIndex(null);
                        setEditingSplitNameValue('');
                      }
                    }}
                    className="text-brand-text text-sm bg-transparent border-b border-brand-gold/45 focus:outline-none min-w-[92px]"
                    placeholder={guestName(i + 1)}
                  />
                ) : rowPaid ? (
                  <span className="text-brand-text text-sm">{localizeSplitPersonName(r.name, lang)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => startInlineRename(i)}
                    className="text-brand-text text-sm hover:text-brand-gold transition-colors"
                  >
                    {localizeSplitPersonName(r.name, lang)}
                  </button>
                )
              ) : (
                <span className="text-brand-text text-sm">{localizeSplitPersonName(r.name, lang)}</span>
              )}
              {splitMode === 'custom' ? (
                i === customAmounts.length - 1 ? (
                  <span className="text-brand-gold font-medium">€{r.amount.toFixed(2)}</span>
                ) : (
                  editingCustomAmountIndex === i ? (
                    <div className="flex items-center justify-end text-brand-gold font-medium text-sm min-w-[92px]">
                      <span className="mr-1">€</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoFocus
                        value={editingCustomAmountValue}
                        onChange={(e) => setEditingCustomAmountValue(normalizeAmountInput(e.target.value))}
                        onBlur={() => commitInlineAmountEdit(i)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitInlineAmountEdit(i);
                          }
                          if (e.key === 'Escape') {
                            setEditingCustomAmountIndex(null);
                            setEditingCustomAmountValue('');
                          }
                        }}
                        className="w-16 bg-transparent text-brand-gold font-medium text-sm text-right focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  ) : rowPaid ? (
                    <span className="text-brand-gold font-medium">€{customAmounts[i]?.amount.toFixed(2) || '0.00'}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startInlineAmountEdit(i)}
                      className="text-brand-gold font-medium hover:text-brand-gold-light transition-colors"
                    >
                      €{customAmounts[i]?.amount.toFixed(2) || '0.00'}
                    </button>
                  )
                )
              ) : (
                <span className="text-brand-gold font-medium">€{r.amount.toFixed(2)}</span>
              )}
            </div>
          );
          })}
        </div>
        {splitMode === 'custom' && !splitLocked && (
          <button
            onClick={() => {
              setCustomAmounts(prev => {
                const nextIndex = prev.length;
                const fallback = guestName(nextIndex + 1);
                const name = splitPeople[nextIndex]?.name || fallback;
                return [...prev, { name, amount: 0 }];
              });
              setSplitPeople((prev) => {
                if (prev.length > customAmounts.length) return prev;
                const nextIndex = prev.length;
                return [...prev, { id: `p${nextIndex + 1}`, name: guestName(nextIndex + 1) }];
              });
            }}
            className="mt-3 w-full text-brand-text-muted text-sm py-2 border border-dashed border-brand-border rounded-xl hover:border-brand-gold/50 transition-colors"
          >
            + {t.addPerson}
          </button>
        )}
      </div>

      {splitValidationMessage ? (
        <p className="px-4 pb-2 text-[13px] text-red-500">{splitValidationMessage}</p>
      ) : null}

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
            className={`w-full rounded-xl border bg-brand-card px-3 py-2.5 text-sm text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:ring-1 ${
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

      {/* 呼叫结账 */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-mobile px-4 z-20 space-y-2">
        <Button
          className="w-full"
          size="lg"
          onClick={handleCallBill}
          loading={submitting}
          disabled={orderLines.length === 0 || !sessionId || isSyncing || submitting || (!!splitMode && !splitValidation.ok) || customerNifInvalid}
        >
          🔔 {t.callBill} — €{total.toFixed(2)}
        </Button>
      </div>
    </div>
  );
}
