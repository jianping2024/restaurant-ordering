'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
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
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import {
  checkoutPersonKey,
  isCheckoutRequestBusy,
  mergeBillSplitsFromRefresh,
} from '@/lib/checkout-request-state';
import { formatPortugueseNif } from '@/lib/pt-nif';
import { tableIdsEqual } from '@/lib/restaurant-tables';
import { CloseTableSessionAction } from '@/components/dashboard/CloseTableSessionAction';

/** Fallback when Realtime is delayed; only runs while the tab is visible. */
const CHECKOUT_REQUESTS_POLL_MS = 30_000;

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
  /** From server after loadDashboardAccess — used for Realtime filter (RLS enforces access). */
  restaurantId: string;
  /** When set, fully paid checkout enqueues a thermal order_receipt print job. */
  restaurantSlug?: string;
  /** Frontdesk: show receipt printer picker on checkout. */
  showPrinterSettings?: boolean;
  /** Owner or frontdesk may force-close unpaid tables from checkout. */
  canCloseTable?: boolean;
  /** Deep link from owner waiter board: auto-open this table's checkout request. */
  initialTableId?: string;
}

export function CheckoutRequestsManager({
  initialRequests,
  restaurantId,
  restaurantSlug,
  showPrinterSettings = true,
  canCloseTable = false,
  initialTableId,
}: Props) {
  const [requests, setRequests] = useState<BillSplit[]>(initialRequests);
  const [processingKeys, setProcessingKeys] = useState<Set<string>>(() => new Set());
  const [discountRateById, setDiscountRateById] = useState<Record<string, number>>({});
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const locale = UI_LOCALE_BY_LANG[lang];
  const supabase = useMemo(() => createClient(), []);
  const [selectedLines, setSelectedLines] = useState<CheckoutDisplayLine[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedReceiptPrinterId, setSelectedReceiptPrinterId] = useState('');
  const [printSettingsOpen, setPrintSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevRequestCountRef = useRef<number | null>(null);
  const refreshSeqRef = useRef(0);
  const deepLinkConsumedRef = useRef(false);

  useEffect(() => {
    setSoundEnabled(loadCheckoutSoundEnabled());
  }, []);

  useEffect(() => {
    if (!restaurantSlug || !showPrinterSettings) return;
    const saved = loadSavedReceiptPrinterId(restaurantSlug);
    setSelectedReceiptPrinterId(saved);
    setPrintSettingsOpen(!saved);
  }, [restaurantSlug, showPrinterSettings]);

  useEffect(() => {
    if (!restaurantSlug || !showPrinterSettings) return;
    saveReceiptPrinterId(restaurantSlug, selectedReceiptPrinterId);
  }, [restaurantSlug, selectedReceiptPrinterId, showPrinterSettings]);

  useEffect(() => {
    if (!initialTableId || deepLinkConsumedRef.current) return;
    const match = requests.find((r) => tableIdsEqual(r.table_id, initialTableId));
    if (match) {
      setSelectedRequestId(match.id);
      deepLinkConsumedRef.current = true;
    }
  }, [initialTableId, requests]);

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

  const refreshCheckoutRequests = useCallback(async () => {
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
  }, [supabase, restaurantId]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let pollTimer: number | null = null;

    const subscribe = () => {
      if (channel) return;
      void refreshCheckoutRequests();
      channel = supabase
        .channel(`checkout-requests-${restaurantId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bill_splits',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          () => void refreshCheckoutRequests(),
        )
        .subscribe();
      pollTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void refreshCheckoutRequests();
        }
      }, CHECKOUT_REQUESTS_POLL_MS);
    };

    const unsubscribe = () => {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') subscribe();
      else unsubscribe();
    };

    if (document.visibilityState === 'visible') subscribe();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [supabase, restaurantId, refreshCheckoutRequests]);

  useEffect(() => {
    if (selectedRequestId && !requests.some((r) => r.id === selectedRequestId)) {
      setSelectedRequestId(null);
    }
  }, [requests, selectedRequestId]);

  useEffect(() => {
    if (!restaurantId || !selectedRequestId) {
      setSelectedLines([]);
      return;
    }

    const sessionId = requests.find((r) => r.id === selectedRequestId)?.session_id;
    if (!sessionId) {
      setSelectedLines([]);
      return;
    }

    let cancelled = false;
    const loadLines = async () => {
      const { data: orderRows, error } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('session_id', sessionId);

      if (cancelled) return;
      if (error) {
        setSelectedLines([]);
        return;
      }

      const menuItemIds = distinctMenuItemIdsFromOrders((orderRows || []) as Order[]);
      let itemCodeByMenuId: Record<string, string> = {};
      if (menuItemIds.length > 0) {
        const { data: menuRows } = await supabase
          .from('menu_items')
          .select('id, item_code')
          .eq('restaurant_id', restaurantId)
          .in('id', menuItemIds);
        itemCodeByMenuId = menuItemCodeLookupFromRows(menuRows ?? []);
      }

      setSelectedLines(checkoutLinesFromOrders((orderRows || []) as Order[], itemCodeByMenuId));
    };

    void loadLines();
    return () => {
      cancelled = true;
    };
  }, [supabase, restaurantId, requests, selectedRequestId]);

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
        ...(showPrinterSettings && selectedReceiptPrinterId
          ? { receiptPrinterId: selectedReceiptPrinterId }
          : {}),
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
  const selectedRequest = selectedRequestId
    ? requests.find((r) => r.id === selectedRequestId)
    : undefined;

  const checkoutDetail = selectedRequest ? (
    <div className="bg-brand-card border border-brand-border rounded-xl px-5 py-5 shadow-sm">
      <button
        type="button"
        onClick={() => setSelectedRequestId(null)}
        className="text-sm text-brand-text-muted hover:text-brand-gold transition-colors mb-4"
      >
        ← {t.backToList}
      </button>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-heading text-3xl text-brand-text leading-none">
            {t.table} {selectedRequest.display_name}
          </p>
          <p className="text-brand-text-muted text-[13px] mt-2">
            {new Date(selectedRequest.created_at).toLocaleString(locale)}
          </p>
          <p className="mesa-text-warning text-[12px] mt-1">
            {t.waitingSince.replace(
              '{duration}',
              formatWaitDuration(selectedRequest.created_at, t),
            )}
          </p>
          {selectedRequest.customer_nif ? (
            <p className="text-brand-text text-[13px] mt-2">
              {t.customerNif}:{' '}
              <span className="font-mono tabular-nums">
                {formatPortugueseNif(selectedRequest.customer_nif)}
              </span>
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-brand-gold font-semibold">{t.amount} €{selectedRequest.total_amount.toFixed(2)}</p>
          <p className="text-[12px] text-brand-text-muted mt-1">
            {t.finalAmount} €{getPayable(selectedRequest).toFixed(2)}
          </p>
          <span className="text-[13px] px-2 py-0.5 rounded-full mesa-badge-warning">
            {t.requested}
          </span>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-brand-border/60 overflow-hidden">
        <p className="text-[13px] text-brand-text-muted px-3 pt-3 pb-2">{t.orderItems}</p>
        {selectedLines.length === 0 ? (
          <p className="text-brand-text-muted text-sm px-3 pb-3">{t.orderItemsEmpty}</p>
        ) : (
          <div className="border-t border-brand-border/60">
            {selectedLines.map((line) => (
              <div
                key={line.key}
                className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-brand-border/40 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                  {line.emoji ? <span>{line.emoji}</span> : null}
                  {line.itemCode && (
                    <span className="font-mono text-[11px] text-brand-gold tabular-nums shrink-0">
                      [{line.itemCode}]
                    </span>
                  )}
                  <span className="text-brand-text text-sm truncate">{line.name || '—'}</span>
                  <span className="text-brand-text-muted text-[13px]">× {line.qty}</span>
                </div>
                <span className="text-brand-gold text-sm shrink-0">
                  €{line.lineTotal.toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2.5 bg-brand-border/25">
              <span className="text-brand-text font-medium text-sm">{t.orderItemsTotal}</span>
              <span className="font-heading text-lg text-brand-gold">
                €{selectedRequest.total_amount.toFixed(2)}
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
            value={getDiscountRate(selectedRequest.id)}
            onChange={(next) =>
              setDiscountRateById((prev) => ({ ...prev, [selectedRequest.id]: next }))
            }
            className="w-28 bg-brand-bg border border-brand-border rounded-lg px-3 py-1.5 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            placeholder="0"
            disabled={hasConfirmedPerson(selectedRequest)}
          />
        </div>
      </div>
      {getSplitRows(selectedRequest).length > 0 && (
        <div className="mt-3 rounded-lg border border-brand-border/60 p-3">
          <p className="text-[13px] text-brand-text-muted mb-2">{t.splitResult}</p>
          <div className="space-y-1.5">
            {getDiscountedSplitResult(selectedRequest).map((row, idx) => (
              <div key={`${selectedRequest.id}-${idx}`} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-brand-text">{row.name}</span>
                  {row.paid && <span className="text-[11px] px-2 py-0.5 rounded-full mesa-badge-success">{t.paid}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-brand-gold">€{Number(row.amount).toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => void handleConfirmPersonPaid(selectedRequest, idx)}
                    disabled={
                      !!row.paid ||
                      isCheckoutRequestBusy(processingKeys, selectedRequest.id)
                    }
                    className="text-sm font-semibold px-4 py-2 rounded-lg mesa-badge-success hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {processingKeys.has(checkoutPersonKey(selectedRequest.id, idx))
                      ? t.processing
                      : t.confirmOnePaid}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {canCloseTable ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-brand-border/50 pt-4">
          <CloseTableSessionAction
            tableId={selectedRequest.table_id}
            isCheckoutPending
            onClosed={() => {
              setSelectedRequestId(null);
              void refreshCheckoutRequests();
            }}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-red-500/40 text-red-600 dark:text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
          />
        </div>
      ) : null}
    </div>
  ) : null;

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

        {restaurantSlug && showPrinterSettings ? (
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
      ) : checkoutDetail ?? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {requests.map((request) => (
            <button
              key={request.id}
              type="button"
              onClick={() => setSelectedRequestId(request.id)}
              className="group rounded-xl border border-amber-500/35 bg-amber-500/8 px-4 py-3 text-left shadow-sm shadow-amber-900/5 transition-all duration-150 hover:border-amber-500/55 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-2xl text-brand-text leading-none">
                    {t.table} {request.display_name}
                  </p>
                  <p className="text-brand-text-muted text-[12px] mt-2">
                    {new Date(request.created_at).toLocaleString(locale)}
                  </p>
                  <p className="mesa-text-warning text-[12px] mt-1">
                    {t.waitingSince.replace(
                      '{duration}',
                      formatWaitDuration(request.created_at, t),
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-brand-gold font-semibold text-lg">
                    €{request.total_amount.toFixed(2)}
                  </p>
                  <span className="inline-block text-[11px] px-2 py-0.5 rounded-full mesa-badge-warning mt-1.5">
                    {t.requested}
                  </span>
                </div>
              </div>
              <p className="text-[12px] text-brand-text-muted mt-3 transition-colors group-hover:text-brand-gold">
                {t.clickToCheckout}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
