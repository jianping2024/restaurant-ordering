'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { IntegerInput } from '@/components/ui/IntegerInput';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import type { BillSplit, Order } from '@/types';
import { showToast } from '@/components/ui/Toast';
import { ReasonConfirmDialog } from '@/components/ui/ReasonConfirmDialog';
import {
  checkoutPayableAmount,
  discountedSplitRows,
  normalizeSplitRows,
} from '@/lib/checkout-split-math';
import { abnormalReasonOptions } from '@/lib/audit/reason-labels';
import { useCheckoutBillDiscount } from '@/lib/checkout-discount/use-checkout-bill-discount';
import { requestCheckoutApplyDiscount } from '@/lib/request-checkout-apply-discount';
import { requestCheckoutConfirmPayment } from '@/lib/request-checkout-confirm-payment';
import { requestOrderReceiptPrint } from '@/lib/request-order-receipt-print';
import {
  checkoutLinesFromOrders,
  type CheckoutDisplayLine,
} from '@/lib/checkout-session-lines';
import { playCheckoutRequestChime } from '@/lib/checkout-notification-sound';
import {
  loadCheckoutSoundEnabled,
  saveCheckoutSoundEnabled,
} from '@/lib/receipt-printer-preference';
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import {
  checkoutBillPrintKey,
  checkoutPersonKey,
  checkoutResumeOrderingKey,
  isCheckoutRequestBusy,
  mergeBillSplitsFromRefresh,
} from '@/lib/checkout-request-state';
import {
  type SessionCollectedPayment,
  resumeCheckoutBlockReason,
  suggestedCollectionAmount,
  sumCollectedByPersonName,
  totalCollectedAmount,
} from '@/lib/checkout-session-payments';
import { requestCheckoutResumeOrdering } from '@/lib/request-checkout-resume-ordering';
import { useCheckoutBillPrintCooldown } from '@/lib/use-checkout-bill-print-cooldown';
import { formatPortugueseNif } from '@/lib/pt-nif';
import { tableIdsEqual } from '@/lib/restaurant-tables';
import { localizeSplitPersonName } from '@/lib/split-person-label';
import { CloseTableSessionAction } from '@/components/dashboard/CloseTableSessionAction';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

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
  /** Owner or frontdesk may force-close unpaid tables from checkout. */
  canCloseTable?: boolean;
  /** Deep link from owner waiter board: auto-open this table's checkout request. */
  initialTableId?: string;
}

export function CheckoutRequestsManager({
  initialRequests,
  restaurantId,
  restaurantSlug,
  canCloseTable = false,
  initialTableId,
}: Props) {
  const [requests, setRequests] = useState<BillSplit[]>(initialRequests);
  const [processingKeys, setProcessingKeys] = useState<Set<string>>(() => new Set());
  const billDiscount = useCheckoutBillDiscount();
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const discountReasonOptionsList = useMemo(
    () => abnormalReasonOptions(lang, 'discount'),
    [lang],
  );
  const locale = UI_LOCALE_BY_LANG[lang];
  const supabase = useMemo(() => createClient(), []);
  const [selectedLines, setSelectedLines] = useState<CheckoutDisplayLine[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [collectedPayments, setCollectedPayments] = useState<SessionCollectedPayment[]>([]);
  const [resumeConfirmOpen, setResumeConfirmOpen] = useState(false);
  const { cooldownSecondsLeft, isOnCooldown, startCooldown } = useCheckoutBillPrintCooldown();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevRequestCountRef = useRef<number | null>(null);
  const refreshSeqRef = useRef(0);
  const deepLinkConsumedRef = useRef(false);

  useEffect(() => {
    setSoundEnabled(loadCheckoutSoundEnabled());
  }, []);

  useEffect(() => {
    if (!initialTableId || deepLinkConsumedRef.current) return;
    const match = requests.find((r) => tableIdsEqual(r.table_id, initialTableId));
    if (match) {
      setSelectedRequestId(match.id);
      deepLinkConsumedRef.current = true;
    }
  }, [initialTableId, requests]);

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

  useEffect(() => {
    if (!restaurantId || !selectedRequestId) {
      setCollectedPayments([]);
      return;
    }

    const sessionId = requests.find((r) => r.id === selectedRequestId)?.session_id;
    if (!sessionId) {
      setCollectedPayments([]);
      return;
    }

    let cancelled = false;
    const loadCollectedPayments = async () => {
      const { data, error } = await supabase
        .from('session_collected_payments')
        .select('id, person_name, amount, created_at')
        .eq('restaurant_id', restaurantId)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (error) {
        setCollectedPayments([]);
        return;
      }

      setCollectedPayments(
        (data || []).map((row) => ({
          id: row.id as string,
          person_name: row.person_name as string,
          amount: Number(row.amount),
          created_at: row.created_at as string,
        })),
      );
    };

    void loadCollectedPayments();
    return () => {
      cancelled = true;
    };
  }, [supabase, restaurantId, requests, selectedRequestId]);

  const getDiscountRate = (request: BillSplit) =>
    billDiscount.getDisplayRate(request.id, request.discount_rate ?? 0);
  const getPayable = (request: BillSplit) => checkoutPayableAmount(request, getDiscountRate(request));
  const getSplitRows = (request: BillSplit) => normalizeSplitRows(request);

  const getDiscountedSplitResult = (request: BillSplit) =>
    discountedSplitRows(request, getDiscountRate(request));

  const hasConfirmedPerson = (request: BillSplit) => (request.result || []).some((row) => !!row.paid);

  const patchRequestDiscount = useCallback(
    (
      requestId: string,
      discount: {
        discount_rate: number;
        discount_reason: string | null;
        discount_reason_detail: string | null;
      },
    ) => {
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, ...discount } : r)),
      );
      billDiscount.finishSetup(requestId);
    },
    [billDiscount],
  );

  const persistDiscount = useCallback(
    async (
      request: BillSplit,
      rate: number,
      reason?: string,
      detail?: string,
    ) => {
      if (!restaurantSlug) {
        showToast('操作失败，请重试', 'error');
        return false;
      }
      billDiscount.setApplying(request.id);
      try {
        const outcome = await requestCheckoutApplyDiscount({
          slug: restaurantSlug,
          billSplitId: request.id,
          discountRate: rate,
          ...(reason ? { discountReason: reason } : {}),
          ...(detail ? { discountReasonDetail: detail } : {}),
        });
        if (!outcome.ok) {
          const message =
            outcome.error === 'reason_required'
              ? t.discountReasonRequired
              : outcome.error === 'reason_detail_required'
                ? t.discountReasonDetailRequired
                : outcome.error === 'discount_locked_after_payment'
                  ? t.discountLockedAfterPayment
                  : '操作失败，请重试';
          showToast(message, 'error');
          return false;
        }
        patchRequestDiscount(request.id, outcome);
        return true;
      } catch {
        showToast('操作失败，请重试', 'error');
        return false;
      } finally {
        billDiscount.setApplying(null);
      }
    },
    [billDiscount, patchRequestDiscount, restaurantSlug, t],
  );

  const handleDiscountRateBlur = (request: BillSplit) => {
    const rate = getDiscountRate(request);
    const serverRate = request.discount_rate ?? 0;
    const setup = billDiscount.beginSetupIfNeeded(
      request.id,
      rate,
      serverRate,
      request.discount_reason,
    );
    if (setup.needsReason) return;
    if (rate === serverRate) {
      billDiscount.finishSetup(request.id);
      return;
    }
    void persistDiscount(
      request,
      rate,
      request.discount_reason ?? undefined,
      request.discount_reason_detail ?? undefined,
    );
  };

  const submitConfirmPersonPaid = async (request: BillSplit, rowIndex: number) => {
    const discountedRows = getDiscountedSplitResult(request);
    const row = discountedRows[rowIndex];
    if (!row || row.paid) return;
    if (!restaurantSlug) {
      showToast('操作失败，请重试', 'error');
      return;
    }

    const collectedByPerson = sumCollectedByPersonName(collectedPayments);
    const collectedAmount = suggestedCollectionAmount(row.name, row.amount, collectedByPerson);

    const personKey = checkoutPersonKey(request.id, rowIndex);
    setProcessingKeys((prev) => new Set(prev).add(personKey));
    try {
      const outcome = await requestCheckoutConfirmPayment({
        slug: restaurantSlug,
        billSplitId: request.id,
        personIndex: rowIndex,
        collectedAmount,
      });
      if (!outcome.ok) {
        showToast(outcome.error === 'already_paid' ? t.paid : '操作失败，请重试', 'error');
        return;
      }

      if (request.session_id) {
        const { data } = await supabase
          .from('session_collected_payments')
          .select('id, person_name, amount, created_at')
          .eq('restaurant_id', restaurantId)
          .eq('session_id', request.session_id)
          .order('created_at', { ascending: true });
        setCollectedPayments(
          (data || []).map((payment) => ({
            id: payment.id as string,
            person_name: payment.person_name as string,
            amount: Number(payment.amount),
            created_at: payment.created_at as string,
          })),
        );
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

  const handleConfirmPersonPaid = (request: BillSplit, rowIndex: number) => {
    void submitConfirmPersonPaid(request, rowIndex);
  };

  const handleResumeOrdering = async (request: BillSplit) => {
    if (!restaurantSlug) {
      showToast(t.resumeOrderingFailed, 'error');
      return;
    }

    const resumeKey = checkoutResumeOrderingKey(request.id);
    setProcessingKeys((prev) => new Set(prev).add(resumeKey));
    try {
      const outcome = await requestCheckoutResumeOrdering({
        slug: restaurantSlug,
        tableId: request.table_id,
      });
      if (!outcome.ok) {
        const message =
          outcome.error === 'whole_table_paid'
            ? t.resumeOrderingBlockedWholeTable
            : t.resumeOrderingFailed;
        showToast(message, 'error');
        return;
      }

      setSelectedRequestId(null);
      void refreshCheckoutRequests();
      showToast(t.resumeOrderingSuccess, 'success');
    } catch {
      showToast(t.resumeOrderingFailed, 'error');
    } finally {
      setProcessingKeys((prev) => {
        const next = new Set(prev);
        next.delete(resumeKey);
        return next;
      });
      setResumeConfirmOpen(false);
    }
  };

  const handlePrintBill = async (request: BillSplit) => {
    if (!restaurantSlug) {
      showToast(t.printBillFailed, 'error');
      return;
    }
    if (isOnCooldown(request.id)) {
      showToast(
        t.printBillCooldown.replace('{n}', String(cooldownSecondsLeft(request.id))),
        'error',
      );
      return;
    }

    const printKey = checkoutBillPrintKey(request.id);
    setProcessingKeys((prev) => new Set(prev).add(printKey));
    try {
      const outcome = await requestOrderReceiptPrint({
        slug: restaurantSlug,
        tableId: request.table_id,
        sessionId: request.session_id,
        billSplitId: request.id,
        receiptVariant: 'checkout_bill',
        discountRate: getDiscountRate(request),
      });

      if (!outcome.ok) {
        showToast(t.printBillFailed, 'error');
        return;
      }
      if (outcome.skipped) {
        showToast(t.printBillSkipped, 'error');
        return;
      }

      startCooldown(request.id);
      showToast(t.printBillSuccess, 'success');
    } catch {
      showToast(t.printBillFailed, 'error');
    } finally {
      setProcessingKeys((prev) => {
        const next = new Set(prev);
        next.delete(printKey);
        return next;
      });
    }
  };

  const pendingLabel = t.pendingBadge.replace('{n}', String(requests.length));
  const selectedRequest = selectedRequestId
    ? requests.find((r) => r.id === selectedRequestId)
    : undefined;
  const collectedByPerson = useMemo(
    () => sumCollectedByPersonName(collectedPayments),
    [collectedPayments],
  );
  const showCollectedLedger = collectedPayments.length > 0;
  const resumeBlockReason = selectedRequest
    ? resumeCheckoutBlockReason(selectedRequest, collectedPayments)
    : null;

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
            value={getDiscountRate(selectedRequest)}
            onChange={(next) => billDiscount.handleRateChange(selectedRequest.id, next)}
            onFocus={() =>
              billDiscount.handleRateFocus(selectedRequest.id, selectedRequest.discount_rate ?? 0)
            }
            onBlur={() => handleDiscountRateBlur(selectedRequest)}
            className="w-28 bg-brand-bg border border-brand-border rounded-lg px-3 py-1.5 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            placeholder="0"
            disabled={
              hasConfirmedPerson(selectedRequest) ||
              billDiscount.applyingRequestId === selectedRequest.id
            }
          />
        </div>
      </div>
      {showCollectedLedger && (
        <div className="mt-3 rounded-lg border border-brand-border/60 p-3">
          <p className="text-[13px] text-brand-text-muted mb-2">{t.collectedPaymentsTitle}</p>
          <div className="space-y-1.5">
            {collectedPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-brand-text">
                  {localizeSplitPersonName(payment.person_name, lang)}
                </span>
                <span className="text-brand-gold">€{payment.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-brand-border/40">
            <span className="text-brand-text-muted">{t.collectedPaymentsTotal}</span>
            <span className="text-brand-gold font-medium">
              €{totalCollectedAmount(collectedPayments).toFixed(2)}
            </span>
          </div>
        </div>
      )}
      {getSplitRows(selectedRequest).length > 0 && (
        <div className="mt-3 rounded-lg border border-brand-border/60 p-3">
          <p className="text-[13px] text-brand-text-muted mb-2">{t.splitResult}</p>
          <div className="space-y-2">
            {getDiscountedSplitResult(selectedRequest).map((row, idx) => {
              const priorCollected = collectedByPerson.get(row.name.trim()) ?? 0;
              const suggested = suggestedCollectionAmount(row.name, row.amount, collectedByPerson);
              return (
              <div key={`${selectedRequest.id}-${idx}`} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-brand-text">{localizeSplitPersonName(row.name, lang)}</span>
                    {row.paid && <span className="text-[11px] px-2 py-0.5 rounded-full mesa-badge-success">{t.paid}</span>}
                  </div>
                  {showCollectedLedger && (
                    <div className="text-[11px] text-brand-text-muted">
                      {t.collectedSoFar}: €{priorCollected.toFixed(2)}
                      {' · '}
                      {t.suggestedThisTime}: €{suggested.toFixed(2)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
            );
            })}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-brand-border/50 pt-4">
        <button
          type="button"
          onClick={() => void handlePrintBill(selectedRequest)}
          disabled={
            processingKeys.has(checkoutBillPrintKey(selectedRequest.id)) ||
            isOnCooldown(selectedRequest.id)
          }
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-brand-border text-brand-text hover:bg-brand-border/30 disabled:opacity-50 transition-colors"
        >
          {processingKeys.has(checkoutBillPrintKey(selectedRequest.id))
            ? t.printBillOperating
            : isOnCooldown(selectedRequest.id)
              ? t.printBillCooldown.replace('{n}', String(cooldownSecondsLeft(selectedRequest.id)))
              : t.printBill}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setResumeConfirmOpen(true)}
            disabled={
              !!resumeBlockReason ||
              processingKeys.has(checkoutResumeOrderingKey(selectedRequest.id)) ||
              isCheckoutRequestBusy(processingKeys, selectedRequest.id)
            }
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-brand-border text-brand-text hover:bg-brand-border/30 disabled:opacity-50 transition-colors"
          >
            {processingKeys.has(checkoutResumeOrderingKey(selectedRequest.id))
              ? t.resumeOrderingOperating
              : t.resumeOrdering}
          </button>
          {canCloseTable ? (
            <CloseTableSessionAction
              tableId={selectedRequest.table_id}
              isCheckoutPending
              onClosed={() => {
                setSelectedRequestId(null);
                void refreshCheckoutRequests();
              }}
            />
          ) : null}
        </div>
      </div>
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
      <ReasonConfirmDialog
        open={billDiscount.pendingSetup != null}
        onClose={billDiscount.cancelSetup}
        title={t.discountReasonTitle}
        message={t.discountReasonMessage}
        reasonLabel={t.discountReasonLabel}
        detailLabel={t.discountReasonDetailLabel}
        detailPlaceholder={t.discountReasonDetailPlaceholder}
        confirmLabel={t.discountReasonConfirm}
        cancelLabel={t.discountReasonCancel}
        reasonRequiredError={t.discountReasonRequired}
        detailRequiredError={t.discountReasonDetailRequired}
        reasons={discountReasonOptionsList}
        reasonGroup="discount"
        confirming={billDiscount.applyingRequestId != null}
        onConfirm={async (reason, detail) => {
          const setup = billDiscount.pendingSetup;
          if (!setup || !selectedRequest) return;
          const request = requests.find((r) => r.id === setup.requestId) ?? selectedRequest;
          await persistDiscount(request, setup.rate, reason, detail);
        }}
      />
      <ConfirmModal
        open={resumeConfirmOpen && !!selectedRequest}
        onClose={() => setResumeConfirmOpen(false)}
        title={t.resumeOrderingConfirmTitle}
        message={t.resumeOrderingConfirmMessage}
        confirmLabel={t.resumeOrdering}
        cancelLabel={t.resumeOrderingCancel}
        confirming={
          !!selectedRequest &&
          processingKeys.has(checkoutResumeOrderingKey(selectedRequest.id))
        }
        onConfirm={() => {
          if (!selectedRequest) return;
          void handleResumeOrdering(selectedRequest);
        }}
      />
    </div>
  );
}
