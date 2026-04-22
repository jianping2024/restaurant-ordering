'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import type { BillSplit, Order, SplitMode, SplitResult } from '@/types';
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
              <p className="px-4 py-2 text-xs text-brand-text-muted border-b border-brand-border">{t.splitResult}</p>
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-brand-border last:border-0">
                  <span className="text-brand-text text-sm">{r.name}</span>
                  <span className="text-brand-gold font-medium">€{r.amount.toFixed(2)}</span>
                </div>
              ))}
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
                <span className="text-brand-text text-sm">{item.name_pt}</span>
                <span className="text-brand-text-muted text-xs">× {item.qty}</span>
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
          <p className="text-brand-text-muted text-xs mb-2">
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
                  <p className="text-brand-text text-sm">{item.emoji} {item.name_pt} × {item.qty}</p>
                  <span className="text-brand-gold text-xs">€{(item.price * item.qty).toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {byItemPersons.map(person => (
                    <button
                      key={person}
                      onClick={() => togglePersonForItem(item.key, person)}
                      className={`text-xs px-3 py-1 rounded-full transition-all ${
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
