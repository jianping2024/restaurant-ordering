'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import type { BillSplit } from '@/types';
import { showToast } from '@/components/ui/Toast';

interface Props {
  initialRequests: BillSplit[];
}

export function CheckoutRequestsManager({ initialRequests }: Props) {
  const [requests, setRequests] = useState<BillSplit[]>(initialRequests);
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [discountRateById, setDiscountRateById] = useState<Record<string, number>>({});
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const locale = UI_LOCALE_BY_LANG[lang];
  const supabase = useMemo(() => createClient(), []);
  const restaurantId = initialRequests[0]?.restaurant_id;

  useEffect(() => {
    if (!restaurantId) return;

    const refresh = async () => {
      const { data } = await supabase
        .from('bill_splits')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'requested')
        .not('session_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);
      setRequests((data || []) as BillSplit[]);
    };

    const channel = supabase
      .channel(`checkout-requests-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bill_splits', filter: `restaurant_id=eq.${restaurantId}` },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, restaurantId]);

  const getDiscountRate = (requestId: string) => Math.min(100, Math.max(0, discountRateById[requestId] || 0));
  const getDiscountAmount = (request: BillSplit) => request.total_amount * (getDiscountRate(request.id) / 100);
  const getPayable = (request: BillSplit) => Math.max(0, request.total_amount - getDiscountAmount(request));
  const getDiscountedSplitResult = (request: BillSplit) =>
    (request.result || []).map((row) => ({
      ...row,
      amount: Number(row.amount) * (1 - getDiscountRate(request.id) / 100),
    }));

  const hasConfirmedPerson = (request: BillSplit) => (request.result || []).some((row) => !!row.paid);

  const handleConfirmPersonPaid = async (request: BillSplit, rowIndex: number) => {
    const row = request.result?.[rowIndex];
    if (!row || row.paid) return;
    setProcessingKey(`${request.id}-${rowIndex}`);
    const discountedRows = getDiscountedSplitResult(request);
    const nextResult = discountedRows.map((item, idx) => (idx === rowIndex ? { ...item, paid: true } : item));
    const allPaid = nextResult.length > 0 && nextResult.every((item) => !!item.paid);
    const finalAmount = getPayable(request);

    try {
      const { error: billError } = await supabase
        .from('bill_splits')
        .update({
          status: allPaid ? 'paid' : 'requested',
          total_amount: allPaid ? finalAmount : request.total_amount,
          result: nextResult,
        })
        .eq('id', request.id);
      if (billError) throw billError;

      if (allPaid && request.session_id) {
        const { error: sessionError } = await supabase
          .from('table_sessions')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
          })
          .eq('id', request.session_id);
        if (sessionError) throw sessionError;
      }

      setRequests((prev) => (
        allPaid
          ? prev.filter((r) => r.id !== request.id)
          : prev.map((r) => (r.id === request.id ? { ...r, result: nextResult } : r))
      ));
    } catch {
      showToast('操作失败，请重试', 'error');
    } finally {
      setProcessingKey(null);
    }
  };

  return (
    <div className="mb-8">
      <h2 className="font-heading text-2xl text-brand-gold mb-4">{t.title}</h2>
      {requests.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6 text-center text-brand-text-muted text-sm">
          {t.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(request => (
            <div key={request.id} className="bg-brand-card border border-brand-border rounded-xl px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-brand-text font-medium">{t.table} {request.table_number}</p>
                  <p className="text-brand-text-muted text-[13px] mt-1">
                    {new Date(request.created_at).toLocaleString(locale)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-brand-gold font-semibold">{t.amount} €{request.total_amount.toFixed(2)}</p>
                  <p className="text-[12px] text-brand-text-muted mt-1">
                    {t.finalAmount} €{getPayable(request).toFixed(2)}
                  </p>
                  <span className="text-[13px] px-2 py-0.5 rounded-full bg-amber-500/18 border border-amber-500/35 text-amber-800">
                    {t.requested}
                  </span>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-brand-border/60 p-3">
                <label className="text-[13px] text-brand-text-muted block mb-1.5">{t.discountRate}</label>
                <div className="flex items-center gap-2">
                  <span className="text-brand-text-muted text-sm">%</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    max={100}
                    value={discountRateById[request.id] ?? ''}
                    onChange={(e) => {
                      const parsed = Number(e.target.value);
                      const next = Number.isFinite(parsed) ? Math.min(Math.max(0, parsed), 100) : 0;
                      setDiscountRateById((prev) => ({ ...prev, [request.id]: next }));
                    }}
                    className="w-28 bg-brand-bg border border-brand-border rounded-lg px-3 py-1.5 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                    placeholder="0"
                    disabled={hasConfirmedPerson(request)}
                  />
                </div>
              </div>
              {!!request.result?.length && (
                <div className="mt-3 rounded-lg border border-brand-border/60 p-3">
                  <p className="text-[13px] text-brand-text-muted mb-2">{t.splitResult}</p>
                  <div className="space-y-1.5">
                    {getDiscountedSplitResult(request).map((row, idx) => (
                      <div key={`${request.id}-${idx}`} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-brand-text">{row.name}</span>
                          {row.paid && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/16 border border-emerald-500/35 text-emerald-800">{t.paid}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-brand-gold">€{Number(row.amount).toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => handleConfirmPersonPaid(request, idx)}
                            disabled={!!row.paid || processingKey === `${request.id}-${idx}`}
                            className="text-[11px] px-2 py-1 rounded-md border border-emerald-500/45 bg-emerald-500/16 text-emerald-800 hover:bg-emerald-500/26 disabled:opacity-50"
                          >
                            {processingKey === `${request.id}-${idx}` ? t.processing : t.confirmOnePaid}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
