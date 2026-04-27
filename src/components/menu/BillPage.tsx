'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import type { BillSplit, DishFeedbackVote, Order, SplitMode, SplitResult } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { getMessages } from '@/lib/i18n/messages';

interface Props {
  restaurant: { id: string; name: string; slug: string };
  tableNumber: number;
  orders: Order[];
  sessionId: string | null;
  existingSplit: BillSplit | null;
}

interface PersonAmount {
  name: string;
  amount: number;
}

const FEEDBACK_REASON_KEYS = ['taste', 'temp', 'slow', 'mismatch', 'other'] as const;
type FeedbackReasonKey = (typeof FEEDBACK_REASON_KEYS)[number];

export function BillPage({ restaurant, tableNumber, orders, sessionId, existingSplit }: Props) {
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
  const [customAmounts, setCustomAmounts] = useState<PersonAmount[]>([
    { name: guestName(1), amount: 0 },
    { name: guestName(2), amount: 0 },
  ]);
  const [byItemAssign, setByItemAssign] = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = useState(!!existingSplit);
  const [submitting, setSubmitting] = useState(false);
  const [persistedResult, setPersistedResult] = useState<SplitResult[] | null>((existingSplit?.result as SplitResult[] | null) || null);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, { vote?: DishFeedbackVote; reasons: FeedbackReasonKey[] }>>({});
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSkipped, setFeedbackSkipped] = useState(false);

  // 结账金额按本餐次“实际已下单菜品”计算，不限制菜品状态。
  const allItems = orders.flatMap(o => o.items
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
      return Array.from({ length: personCount }, (_, i) => ({
        name: guestName(i + 1),
        amount: each,
      }));
    }

    if (splitMode === 'by_item') {
      const result: Record<string, number> = {};
      allItems.forEach(item => {
        const persons = byItemAssign[item.key] || [];
        if (persons.length === 0) return;
        const share = (item.price * item.qty) / persons.length;
        persons.forEach(p => {
          result[p] = (result[p] || 0) + share;
        });
      });
      return Object.entries(result).map(([name, amount]) => ({ name, amount }));
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

  // 呼叫结账
  const handleCallBill = async () => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const payload = {
        restaurant_id: restaurant.id,
        session_id: sessionId,
        table_number: tableNumber,
        order_ids: contributingOrderIds,
        split_mode: splitMode ?? 'custom',
        persons: results.map(r => ({ name: r.name })),
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
        } else {
          await supabase.from('bill_splits').insert(payload);
        }
      } else {
        await supabase.from('bill_splits').insert(payload);
      }
      if (sessionId) {
        await supabase
          .from('table_sessions')
          .update({ status: 'billing' })
          .eq('id', sessionId);
      }
      setPersistedResult(results);
      setSubmitted(true);
    } catch {
      alert(t.actionFailed);
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

  const byItemPersons = Array.from({ length: personCount }, (_, i) => guestName(i + 1));

  const reviewableItems = useMemo(() => {
    const dedup = new Map<string, { menu_item_id: string; order_id: string; name: string; emoji: string; qty: number }>();
    allItems
      .filter((item) => item.item_status !== 'voided')
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
    if (!submitted || !sessionId) return;
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
    syncFeedbackState();
  }, [submitted, sessionId, restaurant.id]);

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
    if (!sessionId) return;
    setFeedbackSkipped(true);
    const supabase = createClient();
    await supabase
      .from('feedback_sessions')
      .upsert({
        restaurant_id: restaurant.id,
        session_id: sessionId,
        source: 'bill_success',
        shown_at: new Date().toISOString(),
        skipped_at: new Date().toISOString(),
      }, { onConflict: 'session_id' });
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
          <h2 className="font-heading text-3xl text-brand-gold mb-2">{t.notified}</h2>
          <p className="text-brand-text-muted text-sm">{t.comingSoon}</p>
          <p className="text-brand-gold font-heading text-2xl mt-6">
            {t.totalLabel} €{total.toFixed(2)}
          </p>
          {splitMode && (
            <div className="mt-6 bg-brand-card border border-brand-border rounded-xl overflow-hidden text-left">
              <p className="px-4 py-2 text-[13px] text-brand-text-muted border-b border-brand-border">{t.splitResult}</p>
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-brand-border last:border-0">
                  <span className="text-brand-text text-sm">{r.name}</span>
                  <span className="text-brand-gold font-medium">€{r.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

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
                                ? 'bg-emerald-500/16 border-emerald-500/40 text-emerald-800'
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
                                ? 'bg-red-500/15 border-red-500/40 text-red-700'
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
                                  ? 'bg-amber-500/16 border-amber-500/40 text-amber-800'
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

            {!feedbackSubmitted && reviewableItems.length > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <Button variant="outline" onClick={handleSkipFeedback} disabled={feedbackSubmitting || feedbackSkipped}>
                  {t.feedbackSkip}
                </Button>
                <Button onClick={handleSubmitFeedback} loading={feedbackSubmitting} disabled={selectedFeedbackCount === 0}>
                  {t.feedbackSubmit}
                </Button>
              </div>
            )}
          </div>
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
        <p className="text-brand-text-muted text-sm">{t.table} {tableNumber} — {t.settlement}</p>
      </header>

      {/* 账单明细 */}
      <div className="px-4 py-4">
        <h2 className="text-brand-text font-medium mb-3">{t.details}</h2>
        <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
          {allItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between px-4 py-3 border-b border-brand-border last:border-0">
              <div className="flex items-center gap-2">
                <span>{item.emoji}</span>
                <span className="text-brand-text text-sm">{item.name || item.name_pt}</span>
                <span className="text-brand-text-muted text-[13px]">× {item.qty}</span>
              </div>
              <span className="text-brand-gold text-sm">€{(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
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
                  ? 'bg-brand-gold text-brand-bg font-semibold'
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
                  setCustomAmounts(Array.from({ length: n }, (_, i) => ({ name: guestName(i + 1), amount: 0 })));
                }}
                className="w-8 h-8 rounded-full bg-brand-border text-brand-text flex items-center justify-center"
              >−</button>
              <span className="font-heading text-xl text-brand-gold">{personCount}</span>
              <button
                onClick={() => {
                  const n = Math.min(20, personCount + 1);
                  setPersonCount(n);
                  setCustomAmounts(Array.from({ length: n }, (_, i) => ({ name: guestName(i + 1), amount: 0 })));
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
                      key={person}
                      onClick={() => togglePersonForItem(item.key, person)}
                      className={`text-[13px] px-3 py-1 rounded-full transition-all ${
                        (byItemAssign[item.key] || []).includes(person)
                          ? 'bg-brand-gold text-brand-bg font-semibold'
                          : 'bg-brand-border text-brand-text-muted'
                      }`}
                    >
                      {person}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 自定义金额 */}
        {splitMode && splitMode === 'custom' && (
          <div className="space-y-3">
            {customAmounts.map((person, i) => {
              const isLast = i === customAmounts.length - 1;
              const prevTotal = customAmounts.slice(0, i).reduce((s, p) => s + p.amount, 0);
              const remaining = Math.max(0, total - prevTotal);
              return (
                <div key={i} className="flex items-center gap-3 bg-brand-card border border-brand-border rounded-xl px-4 py-3">
                  <input
                    type="text"
                    value={person.name}
                    onChange={e => setCustomAmounts(prev => prev.map((p, j) => j === i ? { ...p, name: e.target.value } : p))}
                    className="flex-1 bg-transparent text-brand-text text-sm focus:outline-none"
                    placeholder={guestName(i + 1)}
                  />
                  {isLast ? (
                    <span className="text-brand-gold font-medium">
                      €{remaining.toFixed(2)}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-brand-text-muted text-sm">€</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={person.amount || ''}
                        onChange={e => setCustomAmounts(prev => prev.map((p, j) => j === i ? { ...p, amount: parseFloat(e.target.value) || 0 } : p))}
                        className="w-20 bg-transparent text-brand-gold font-medium text-sm text-right focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <button
              onClick={() => setCustomAmounts(prev => [...prev, { name: guestName(prev.length + 1), amount: 0 }])}
              className="w-full text-brand-text-muted text-sm py-2 border border-dashed border-brand-border rounded-xl hover:border-brand-gold/50 transition-colors"
            >
              + {t.addPerson}
            </button>
          </div>
        )}
      </div>

      {/* 分单结果 */}
      <div className="px-4 py-4">
        <h2 className="text-brand-text font-medium mb-3">{t.splitResult}</h2>
        <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-brand-border last:border-0">
              <span className="text-brand-text text-sm">{r.name}</span>
              <span className="text-brand-gold font-medium">€{r.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 呼叫结账按钮 */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-mobile px-4 z-20">
        <Button
          className="w-full"
          size="lg"
          onClick={handleCallBill}
          loading={submitting}
          disabled={allItems.length === 0 || !sessionId}
        >
          🔔 {t.callBill} — €{total.toFixed(2)}
        </Button>
      </div>
    </div>
  );
}
