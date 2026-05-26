'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { playCheckoutRequestChime } from '@/lib/checkout-notification-sound';
import {
  loadCheckoutSoundEnabled,
  loadSavedReceiptPrinterId,
  saveCheckoutSoundEnabled,
  saveReceiptPrinterId,
} from '@/lib/receipt-printer-preference';
import {
  checkoutPersonKey,
  isCheckoutRequestBusy,
  mergeBillSplitsFromRefresh,
} from '@/lib/checkout-request-state';

function formatWaitDuration(
  createdAt: string,
  t: ReturnType<typeof getMessages>['checkout'],
): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return t.durationJustNow;
  return t.durationMinutes.replace('{n}', String(mins));
}

interface Props {
  initialRequests: BillSplit[];
  /** When set, fully paid checkout enqueues a thermal order_receipt print job. */
  restaurantSlug?: string;
}

export function CheckoutRequestsManager({ initialRequests, restaurantSlug }: Props) {
  const [requests, setRequests] = useState<BillSplit[]>(initialRequests);
  const [processingKeys, setProcessingKeys] = useState<Set<string>>(() => new Set());
  const [discountRateById, setDiscountRateById] = useState<Record<string, number>>({});
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const billT = getMessages(lang).bill;
  const locale = UI_LOCALE_BY_LANG[lang];
  const supabase = useMemo(() => createClient(), []);
  const restaurantId = initialRequests[0]?.restaurant_id;
  const [linesByRequestId, setLinesByRequestId] = useState<Record<string, CheckoutDisplayLine[]>>({});
  const [selectedReceiptPrinterId, setSelectedReceiptPrinterId] = useState('');
  const [printSettingsOpen, setPrintSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevRequestCountRef = useRef<number | null>(null);
  const refreshSeqRef = useRef(0);

  useEffect(() => {
    if (!restaurantSlug) return;
    const saved = loadSavedReceiptPrinterId(restaurantSlug);
    setSelectedReceiptPrinterId(saved);
    setPrintSettingsOpen(!saved);
    setSoundEnabled(loadCheckoutSoundEnabled());
  }, [restaurantSlug]);

  useEffect(() => {
    if (!restaurantSlug) return;
    saveReceiptPrinterId(restaurantSlug, selectedReceiptPrinterId);
  }, [restaurantSlug, selectedReceiptPrinterId]);

  const handleReceiptPrinterChange = (printerId: string) => {
    setSelectedReceiptPrinterId(printerId);
    setPrintSettingsOpen(!printerId);
  };

  useEffect(() => {
    const prev = prevRequestCountRef.current;
    prevRequestCountRef.current = requests.length;
    if (prev === null) return;
    if (soundEnabled && requests.length > prev) {
      playCheckoutRequestChime();
    }
  }, [requests.length, soundEnabled]);

  useEffect(() => {
    if (!restaurantId) return;

    const refresh = async () => {
      const seq = ++refreshSeqRef.current;
      const { data } = await supabase
        .from('bill_splits')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'requested')
        .not('session_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(100);
      if (seq !== refreshSeqRef.current) return;
      const incoming = (data || []) as BillSplit[];
      setRequests((prev) => mergeBillSplitsFromRefresh(prev, incoming));
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

    const personKey = checkoutPersonKey(request.id, rowIndex);
    setProcessingKeys((prev) => new Set(prev).add(personKey));
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
      setProcessingKeys((prev) => {
        const next = new Set(prev);
        next.delete(personKey);
        return next;
      });
    }
  };

  const pendingLabel = t.pendingBadge.replace('{n}', String(requests.length));

  return (
    <div className="mb-8">
      <header className="mb-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
            <p className="text-brand-text-muted text-sm mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"
                  aria-hidden
                />
                {t.liveConnected}
              </span>
              <span aria-hidden>·</span>
              <span className="font-medium text-brand-text">{pendingLabel}</span>
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-brand-text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => {
                const next = e.target.checked;
                setSoundEnabled(next);
                saveCheckoutSoundEnabled(next);
              }}
              className="rounded border-brand-border text-brand-gold focus:ring-brand-gold/40"
            />
            {t.soundLabel}
          </label>
        </div>

        {restaurantSlug ? (
          <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setPrintSettingsOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm text-brand-text hover:bg-brand-border/30 transition-colors"
              aria-expanded={printSettingsOpen}
            >
              <span className="font-medium">{t.printSettings}</span>
              <span className="text-brand-text-muted text-[13px]">
                {printSettingsOpen ? t.printCollapse : t.printExpand}
              </span>
            </button>
            {printSettingsOpen ? (
              <div className="px-4 pb-4 border-t border-brand-border/60">
                <ReceiptPrinterSelect
                  restaurantSlug={restaurantSlug}
                  value={selectedReceiptPrinterId}
                  onChange={handleReceiptPrinterChange}
                  className="pt-3"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      {requests.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl px-6 py-16 text-center">
          <p className="text-5xl mb-4" aria-hidden>
            🧾
          </p>
          <h2 className="font-heading text-xl text-brand-text">{t.emptyTitle}</h2>
          <p className="text-brand-text-muted text-sm mt-2">{t.empty}</p>
          <p className="text-brand-text-muted text-[13px] mt-4 max-w-md mx-auto leading-relaxed">
            {t.emptyHint}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(request => (
            <div key={request.id} className="bg-brand-card border border-brand-border rounded-xl px-5 py-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-heading text-3xl text-brand-text leading-none">
                    {t.table} {request.display_name}
                  </p>
                  <p className="text-brand-text-muted text-[13px] mt-2">
                    {new Date(request.created_at).toLocaleString(locale)}
                  </p>
                  <p className="mesa-text-warning text-[12px] mt-1">
                    {t.waitingSince.replace(
                      '{duration}',
                      formatWaitDuration(request.created_at, t),
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-brand-gold font-semibold">{t.amount} €{request.total_amount.toFixed(2)}</p>
                  <p className="text-[12px] text-brand-text-muted mt-1">
                    {t.finalAmount} €{getPayable(request).toFixed(2)}
                  </p>
                  <span className="text-[13px] px-2 py-0.5 rounded-full mesa-badge-warning">
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
                            <span className="text-[10px] px-2 py-0.5 rounded-full mesa-badge-danger">
                              {billT.itemPending}
                            </span>
                          )}
                          {line.status === 'cooking' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full mesa-badge-warning">
                              {billT.itemCooking}
                            </span>
                          )}
                          {line.status === 'done' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full mesa-badge-success">
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
                          {row.paid && <span className="text-[11px] px-2 py-0.5 rounded-full mesa-badge-success">{t.paid}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-brand-gold">€{Number(row.amount).toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => void handleConfirmPersonPaid(request, idx)}
                            disabled={
                              !!row.paid ||
                              isCheckoutRequestBusy(processingKeys, request.id)
                            }
                            className="text-sm font-semibold px-4 py-2 rounded-lg mesa-badge-success hover:opacity-90 disabled:opacity-50 transition-opacity"
                          >
                            {processingKeys.has(checkoutPersonKey(request.id, idx))
                              ? t.processing
                              : t.confirmOnePaid}
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
