'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { IntegerInput } from '@/components/ui/IntegerInput';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import type { BillSplit, Order } from '@/types';
import { showToast } from '@/components/ui/Toast';
import { normalizeSplitRows } from '@/lib/checkout-confirm-payment';
import { requestCheckoutConfirmPayment } from '@/lib/request-checkout-confirm-payment';
import {
  checkoutLinesFromOrders,
  type CheckoutDisplayLine,
} from '@/lib/checkout-session-lines';
import { ReceiptPrinterSelect } from '@/components/dashboard/ReceiptPrinterSelect';

interface Props {
  initialRequests: BillSplit[];
  /** When set, fully paid checkout enqueues a thermal order_receipt print job. */
  restaurantSlug?: string;
}

export function CheckoutRequestsManager({ initialRequests, restaurantSlug }: Props) {
  const [requests, setRequests] = useState<BillSplit[]>(initialRequests);
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [discountRateById, setDiscountRateById] = useState<Record<string, number>>({});
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const billT = getMessages(lang).bill;
  const locale = UI_LOCALE_BY_LANG[lang];
  const supabase = useMemo(() => createClient(), []);
  const restaurantId = initialRequests[0]?.restaurant_id;
  const [linesByRequestId, setLinesByRequestId] = useState<Record<string, CheckoutDisplayLine[]>>({});
  const [selectedReceiptPrinterId, setSelectedReceiptPrinterId] = useState('');

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

  useEffect(() => {
    if (!restaurantId || requests.length === 0) {
      setLinesByRequestId({});
      return;
    }

    let cancelled = false;
    const loadLines = async () => {
      const sessionIds = Array.from(
        new Set(
          requests
            .map((r) => r.session_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      );
      if (sessionIds.length === 0) {
        if (!cancelled) setLinesByRequestId({});
        return;
      }

      const { data: orderRows, error } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .in('session_id', sessionIds);

      if (cancelled) return;
      if (error) {
        setLinesByRequestId({});
        return;
      }

      const ordersBySession = new Map<string, Order[]>();
      for (const row of (orderRows || []) as Order[]) {
        const sid = row.session_id;
        if (!sid) continue;
        const list = ordersBySession.get(sid) || [];
        list.push(row);
        ordersBySession.set(sid, list);
      }

      const next: Record<string, CheckoutDisplayLine[]> = {};
      for (const request of requests) {
        if (!request.session_id) {
          next[request.id] = [];
          continue;
        }
        const sessionOrders = ordersBySession.get(request.session_id) || [];
        next[request.id] = checkoutLinesFromOrders(sessionOrders);
      }
      setLinesByRequestId(next);
    };

    void loadLines();
    return () => {
      cancelled = true;
    };
  }, [supabase, restaurantId, requests]);

  const getDiscountRate = (requestId: string) => Math.min(100, Math.max(0, discountRateById[requestId] || 0));
  const getDiscountAmount = (request: BillSplit) => request.total_amount * (getDiscountRate(request.id) / 100);
  const getPayable = (request: BillSplit) => Math.max(0, request.total_amount - getDiscountAmount(request));
  const getSplitRows = (request: BillSplit) => normalizeSplitRows(request);

  const getDiscountedSplitResult = (request: BillSplit) =>
    getSplitRows(request).map((row) => ({
      ...row,
      amount: Number(row.amount) * (1 - getDiscountRate(request.id) / 100),
    }));

  const hasConfirmedPerson = (request: BillSplit) => (request.result || []).some((row) => !!row.paid);

  const handleConfirmPersonPaid = async (request: BillSplit, rowIndex: number) => {
    const discountedRows = getDiscountedSplitResult(request);
    const row = discountedRows[rowIndex];
    if (!row || row.paid) return;
    if (!restaurantSlug) {
      showToast('操作失败，请重试', 'error');
      return;
    }

    setProcessingKey(`${request.id}-${rowIndex}`);
    try {
      const outcome = await requestCheckoutConfirmPayment({
        slug: restaurantSlug,
        billSplitId: request.id,
        personIndex: rowIndex,
        discountRate: getDiscountRate(request.id),
        ...(selectedReceiptPrinterId ? { receiptPrinterId: selectedReceiptPrinterId } : {}),
      });
      if (!outcome.ok) {
        showToast(
          outcome.error === 'already_paid' ? t.paid : '操作失败，请重试',
          'error',
        );
        return;
      }

      setRequests((prev) =>
        outcome.all_paid
          ? prev.filter((r) => r.id !== request.id)
          : prev.map((r) => (r.id === request.id ? { ...r, result: outcome.result } : r)),
      );
    } catch {
      showToast('操作失败，请重试', 'error');
    } finally {
      setProcessingKey(null);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <h2 className="font-heading text-2xl text-brand-gold">{t.title}</h2>
        {restaurantSlug ? (
          <ReceiptPrinterSelect
            restaurantSlug={restaurantSlug}
            value={selectedReceiptPrinterId}
            onChange={setSelectedReceiptPrinterId}
            className="min-w-[200px] sm:max-w-xs w-full sm:w-auto"
          />
        ) : null}
      </div>
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
              <div className="mt-3 rounded-lg border border-brand-border/60 overflow-hidden">
                <p className="text-[13px] text-brand-text-muted px-3 pt-3 pb-2">{t.orderItems}</p>
                {(linesByRequestId[request.id] || []).length === 0 ? (
                  <p className="text-brand-text-muted text-sm px-3 pb-3">{t.orderItemsEmpty}</p>
                ) : (
                  <div className="border-t border-brand-border/60">
                    {(linesByRequestId[request.id] || []).map((line) => (
                      <div
                        key={line.key}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-brand-border/40 last:border-0"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                          {line.emoji ? <span>{line.emoji}</span> : null}
                          <span className="text-brand-text text-sm truncate">{line.name || '—'}</span>
                          <span className="text-brand-text-muted text-[13px]">× {line.qty}</span>
                          {line.status === 'voided' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/12 border border-slate-500/35 text-slate-700">
                              {billT.cancelledTag}
                            </span>
                          )}
                          {line.status === 'pending' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/35 text-red-700">
                              {billT.itemPending}
                            </span>
                          )}
                          {line.status === 'cooking' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/18 border border-amber-500/35 text-amber-800">
                              {billT.itemCooking}
                            </span>
                          )}
                          {line.status === 'done' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/16 border border-emerald-500/35 text-emerald-800">
                              {billT.itemDone}
                            </span>
                          )}
                        </div>
                        <span className="text-brand-gold text-sm shrink-0">
                          €{line.lineTotal.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-3 py-2.5 bg-brand-border/25">
                      <span className="text-brand-text font-medium text-sm">{billT.total}</span>
                      <span className="font-heading text-lg text-brand-gold">
                        €{request.total_amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-3 rounded-lg border border-brand-border/60 p-3">
                <label className="text-[13px] text-brand-text-muted block mb-1.5">{t.discountRate}</label>
                <div className="flex items-center gap-2">
                  <span className="text-brand-text-muted text-sm">%</span>
                  <IntegerInput
                    min={0}
                    max={100}
                    value={getDiscountRate(request.id)}
                    onChange={(next) =>
                      setDiscountRateById((prev) => ({ ...prev, [request.id]: next }))
                    }
                    className="w-28 bg-brand-bg border border-brand-border rounded-lg px-3 py-1.5 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                    placeholder="0"
                    disabled={hasConfirmedPerson(request)}
                  />
                </div>
              </div>
              {getSplitRows(request).length > 0 && (
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
