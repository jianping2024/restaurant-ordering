'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calcByItemSplitResults } from '@/lib/bill-split-by-item';
import { validateBillSplit } from '@/lib/bill-split-validate';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import type { BillSplit, DishFeedbackVote, Order, SplitMode, SplitResult } from '@/types';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { getMessages } from '@/lib/i18n/messages';
import { showToast } from '@/components/ui/Toast';
import { normalizeDecimalInput as normalizeAmountInput } from '@/lib/number-input';
import { ReceiptPrinterSelect } from '@/components/dashboard/ReceiptPrinterSelect';
import { requestOrderReceiptPrint } from '@/lib/request-order-receipt-print';
import { requestCheckoutConfirmPayment } from '@/lib/request-checkout-confirm-payment';

interface Props {
  restaurant: { id: string; name: string; slug: string };
  tableId: string;
  displayName: string;
  orders: Order[];
  sessionId: string | null;
  existingSplit: BillSplit | null;
  returnPath?: string | null;
  initialFeedbackSubmitted?: boolean;
  initialFeedbackSkipped?: boolean;
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
  orders,
  sessionId,
  existingSplit,
  returnPath,
  initialFeedbackSubmitted = false,
  initialFeedbackSkipped = false,
}: Props) {
  const isWaiterFlow = !!returnPath;
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).bill;
  const guestName = (n: number) => `${t.guest} ${n}`;
  const initialSplitMode: SplitMode | null = (() => {
    if (!existingSplit) return null;
    if (existingSplit.split_mode === 'custom' && existingSplit.result?.length === 1) return null;
    return existingSplit.split_mode;
  })();
  const [splitMode, setSplitMode] = useState<SplitMode | null>(initialSplitMode);
  const [personCount, setPersonCount] = useState(2);
  const [splitPeople, setSplitPeople] = useState<SplitPersonSlot[]>([
    { id: 'p1', name: guestName(1) },
    { id: 'p2', name: guestName(2) },
  ]);
  const [customAmounts, setCustomAmounts] = useState<PersonAmount[]>([
    { name: guestName(1), amount: 0 },
    { name: guestName(2), amount: 0 },
  ]);
  const [byItemAssign, setByItemAssign] = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = useState(!!existingSplit);
  const [submitting, setSubmitting] = useState(false);
  const [persistedResult, setPersistedResult] = useState<SplitResult[] | null>((existingSplit?.result as SplitResult[] | null) || null);
  const [persistedSplitId, setPersistedSplitId] = useState<string | null>(existingSplit?.id || null);
  const [personPayProcessingIdx, setPersonPayProcessingIdx] = useState<number | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, { vote?: DishFeedbackVote; reasons: FeedbackReasonKey[] }>>({});
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(initialFeedbackSubmitted);
  const [feedbackSkipped, setFeedbackSkipped] = useState(initialFeedbackSkipped);
  const [feedbackHydrating, setFeedbackHydrating] = useState(() => !!existingSplit && !!sessionId && !returnPath && !initialFeedbackSubmitted && !initialFeedbackSkipped);
  const [liveOrders, setLiveOrders] = useState<Order[]>(orders);
  const [editingSplitNameIndex, setEditingSplitNameIndex] = useState<number | null>(null);
  const [editingSplitNameValue, setEditingSplitNameValue] = useState('');
  const [editingCustomAmountIndex, setEditingCustomAmountIndex] = useState<number | null>(null);
  const [editingCustomAmountValue, setEditingCustomAmountValue] = useState('');
  const [selectedReceiptPrinterId, setSelectedReceiptPrinterId] = useState('');

  const syncNameAcrossModes = (index: number, name: string) => {
    setSplitPeople((prev) => prev.map((person, idx) => (idx === index ? { ...person, name } : person)));
    setCustomAmounts((prev) => prev.map((person, idx) => (idx === index ? { ...person, name } : person)));
  };

  const startInlineRename = (index: number) => {
    const current = splitPeople[index];
    if (!current) return;
    setEditingSplitNameIndex(index);
    setEditingSplitNameValue(current.name);
  };

  const commitInlineRename = (index: number) => {
    const normalized = editingSplitNameValue.trim();
    syncNameAcrossModes(index, normalized || guestName(index + 1));
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

  useEffect(() => {
    setLiveOrders(orders);
  }, [orders]);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();
    const fetchSessionOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      setLiveOrders((data || []) as Order[]);
    };

    void fetchSessionOrders();

    const channel = supabase
      .channel(`bill-orders-${restaurant.id}-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void fetchSessionOrders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant.id, sessionId]);

  // 结账金额按本餐次“实际已下单菜品”计算，不限制菜品状态。
  const allItems = liveOrders.flatMap(o => o.items
    .map((item, idx) => ({
      ...item,
      order_id: o.id,
      key: `${o.id}-${idx}`,
    })));
  const contributingOrderIds = Array.from(new Set(allItems.map(item => item.order_id)));
  const total = allItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  // 计算分单结果
  const calcResult = (): SplitResult[] => {
    if (!splitMode) {
      return [{ name: t.totalLabel, amount: total }];
    }

    if (splitMode === 'even') {
      const each = total / personCount;
      return splitPeople.slice(0, personCount).map((person) => ({
        name: person.name,
        amount: each,
      }));
    }

    if (splitMode === 'by_item') {
      const people = splitPeople.slice(0, personCount);
      return calcByItemSplitResults({
        people,
        lines: allItems.map((item) => ({
          key: item.key,
          name: (item.name || item.name_pt || '').trim(),
          qty: item.qty,
          unitPrice: item.price,
        })),
        assign: byItemAssign,
      });
    }

    // custom 模式
    const manualTotal = customAmounts.slice(0, -1).reduce((sum, p) => sum + p.amount, 0);
    const lastAmount = Math.max(0, total - manualTotal);
    return customAmounts.map((p, i) => ({
      name: p.name,
      amount: i === customAmounts.length - 1 ? lastAmount : p.amount,
    }));
  };

  const results = persistedResult || calcResult();

  const splitValidation = useMemo(
    () =>
      validateBillSplit({
        splitMode,
        total,
        results,
        itemKeys: allItems.map((item) => item.key),
        byItemAssign,
        customAmounts,
      }),
    [splitMode, total, results, allItems, byItemAssign, customAmounts],
  );

  const splitValidationMessage =
    splitValidation.ok
      ? null
      : splitValidation.issue === 'unassigned_items'
        ? t.splitUnassignedItems
        : t.splitAmountMismatch;

  // 呼叫结账
  const handleCallBill = async () => {
    if (!splitValidation.ok) {
      showToast(splitValidationMessage ?? t.splitAmountMismatch, 'error');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const payload = {
        restaurant_id: restaurant.id,
        session_id: sessionId,
        table_id: tableId,
        display_name: displayName,
        order_ids: contributingOrderIds,
        split_mode: splitMode ?? 'custom',
        persons: splitPeople.slice(0, splitMode === 'by_item' ? personCount : results.length).map((person, idx) => ({
          name: results[idx]?.name ?? person.name,
          ...(splitMode === 'by_item'
            ? {
                items: allItems
                  .filter((item) => (byItemAssign[item.key] || []).includes(person.id))
                  .map((item) => item.key),
              }
            : {}),
        })),
        result: results,
        total_amount: total,
        status: 'requested' as const,
      };

      if (sessionId) {
        // 同一餐次重复呼叫结账时，复用并更新未完成请求，避免重复记录。
        const { data: existingRequest } = await supabase
          .from('bill_splits')
          .select('id')
          .eq('session_id', sessionId)
          .in('status', ['pending', 'confirmed', 'requested'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingRequest) {
          await supabase
            .from('bill_splits')
            .update(payload)
            .eq('id', existingRequest.id);
          setPersistedSplitId(existingRequest.id);
        } else {
          const { data: inserted } = await supabase.from('bill_splits').insert(payload).select('id').single();
          setPersistedSplitId(inserted?.id || null);
        }
      } else {
        const { data: inserted } = await supabase.from('bill_splits').insert(payload).select('id').single();
        setPersistedSplitId(inserted?.id || null);
      }
      if (sessionId) {
        await supabase
          .from('table_sessions')
          .update({ status: 'billing' })
          .eq('id', sessionId);
      }
      setPersistedResult(results);
      setSubmitted(true);
      if (sessionId) {
        void requestOrderReceiptPrint({
          slug: restaurant.slug,
          tableId,
          sessionId,
          receiptVariant: 'pre_bill',
          ...(selectedReceiptPrinterId
            ? { receiptPrinterId: selectedReceiptPrinterId }
            : {}),
        });
      }
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 按菜分配中切换人员
  const togglePersonForItem = (itemKey: string, person: string) => {
    setByItemAssign(prev => {
      const current = prev[itemKey] || [];
      const next = current.includes(person)
        ? current.filter(p => p !== person)
        : [...current, person];
      return { ...prev, [itemKey]: next };
    });
  };

  const byItemPersons = splitPeople.slice(0, personCount);

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
    allItems
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
  }, [allItems]);

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
                    <span className="text-brand-text text-sm">{r.name}</span>
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
          {returnPath && (
            <div className="mt-6">
              <Link
                href={returnPath}
                className="inline-flex items-center justify-center rounded-xl border border-brand-border px-4 py-2 text-sm text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
              >
                {lang === 'zh' ? '返回服务员页面' : lang === 'en' ? 'Back to waiter board' : 'Voltar ao painel do garcom'}
              </Link>
            </div>
          )}
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
        {returnPath && (
          <div className="mt-2">
            <Link
              href={returnPath}
              className="text-[13px] text-brand-text-muted hover:text-brand-gold transition-colors"
            >
              {lang === 'zh' ? '返回服务员页面' : lang === 'en' ? 'Back to waiter board' : 'Voltar ao painel do garcom'}
            </Link>
          </div>
        )}
        <p className="text-brand-text-muted text-sm">{t.table} {displayName} — {t.settlement}</p>
      </header>

      {/* 账单明细 */}
      <div className="px-4 py-4">
        <h2 className="text-brand-text font-medium mb-3">{t.details}</h2>
        <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
          {allItems.map((item) => {
            const orderRow = liveOrders.find((o) => o.id === item.order_id);
            const itemSt = orderRow ? normalizeOrderItemStatus(item, orderRow.status) : 'pending';
            return (
            <div key={item.key} className="flex items-center justify-between px-4 py-3 border-b border-brand-border last:border-0 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                <span>{item.emoji}</span>
                <span className="text-brand-text text-sm">{item.name || item.name_pt}</span>
                <span className="text-brand-text-muted text-[13px]">× {item.qty}</span>
                {itemSt === 'voided' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/12 border border-slate-500/35 text-slate-700">
                    {t.cancelledTag}
                  </span>
                )}
                {itemSt === 'pending' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full mesa-badge-danger">
                    {t.itemPending}
                  </span>
                )}
                {itemSt === 'cooking' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full mesa-badge-warning">
                    {t.itemCooking}
                  </span>
                )}
                {itemSt === 'done' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full mesa-badge-success">
                    {t.itemDone}
                  </span>
                )}
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
              onClick={() => setSplitMode(prev => (prev === mode ? null : mode))}
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
        {!splitMode && (
          <p className="text-brand-text-muted text-[13px] mb-2">
            可直接呼叫结账；如需分单再选择上方方式。
          </p>
        )}

        {/* 人数选择（均摊 & 按菜）*/}
        {splitMode && (splitMode === 'even' || splitMode === 'by_item') && (
          <div className="flex items-center gap-4 mb-4">
            <span className="text-brand-text-muted text-sm">{t.people}</span>
            <div className="flex items-center gap-3">
              <button
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
                  setByItemAssign((prev) => {
                    const allowedIds = new Set(splitPeople.slice(0, n).map((person) => person.id));
                    return Object.fromEntries(
                      Object.entries(prev).map(([itemKey, ids]) => [itemKey, ids.filter((id) => allowedIds.has(id))]),
                    );
                  });
                }}
                className="w-8 h-8 rounded-full bg-brand-border text-brand-text flex items-center justify-center"
              >−</button>
              <span className="font-heading text-xl text-brand-gold">{personCount}</span>
              <button
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
        {splitMode && splitMode === 'by_item' && (
          <div className="space-y-3">
            {allItems.map(item => (
              <div key={item.key} className="bg-brand-card border border-brand-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-brand-text text-sm">{item.emoji} {(item.name || item.name_pt)} × {item.qty}</p>
                  <span className="text-brand-gold text-[13px]">€{(item.price * item.qty).toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {byItemPersons.map(person => (
                    <button
                      key={person.id}
                      onClick={() => togglePersonForItem(item.key, person.id)}
                      className={`text-[13px] px-3 py-1 rounded-full transition-all ${
                        (byItemAssign[item.key] || []).includes(person.id)
                          ? 'bg-brand-gold text-brand-on-gold font-semibold'
                          : 'bg-brand-border text-brand-text-muted'
                      }`}
                    >
                      {person.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* 分单结果 */}
      <div className="px-4 py-4">
        <h2 className="text-brand-text font-medium mb-3">{t.splitResult}</h2>
        <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
          {results.map((r, i) => (
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
                ) : (
                  <button
                    type="button"
                    onClick={() => startInlineRename(i)}
                    className="text-brand-text text-sm hover:text-brand-gold transition-colors"
                  >
                    {r.name}
                  </button>
                )
              ) : (
                <span className="text-brand-text text-sm">{r.name}</span>
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
          ))}
        </div>
        {splitMode === 'custom' && (
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

      {/* 呼叫结账 */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-mobile px-4 z-20 space-y-2">
        {isWaiterFlow ? (
          <ReceiptPrinterSelect
            restaurantSlug={restaurant.slug}
            value={selectedReceiptPrinterId}
            onChange={setSelectedReceiptPrinterId}
          />
        ) : null}
        <Button
          className="w-full"
          size="lg"
          onClick={handleCallBill}
          loading={submitting}
          disabled={allItems.length === 0 || !sessionId || (!!splitMode && !splitValidation.ok)}
        >
          🔔 {t.callBill} — €{total.toFixed(2)}
        </Button>
      </div>
    </div>
  );
}
