'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { BillSplit, Order } from '@/types';
import { showToast } from '@/components/ui/Toast';
import { ReasonConfirmDialog } from '@/components/ui/ReasonConfirmDialog';
import {
  checkoutBillPrintKey,
  checkoutPersonKey,
  checkoutResumeOrderingKey,
  mergeBillSplitsFromRefresh,
} from '@/lib/checkout-request-state';
import {
  discountedSplitRows,
} from '@/lib/checkout-split-math';
import {
  hasConfirmedPerson,
  parseSessionCollectedPayments,
  parseSessionCollectedPaymentsWithSession,
  SESSION_COLLECTED_PAYMENT_SELECT,
  type SessionCollectedPayment,
  resumeCheckoutBlockReason,
  resumeOrderingConfirmVariant,
  suggestedCollectionAmount,
  sumCollectedByPersonName,
  unpaidSplitRowsWithIndex,
} from '@/lib/checkout-session-payments';
import { requestCheckoutResumeOrdering } from '@/lib/request-checkout-resume-ordering';
import { useCheckoutBillPrintCooldown } from '@/lib/use-checkout-bill-print-cooldown';
import { tableIdsEqual } from '@/lib/restaurant-tables';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
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
import { invalidateCheckoutRequestCount } from '@/lib/checkout-request-count-sync';
import {
  loadCheckoutSoundEnabled,
  saveCheckoutSoundEnabled,
} from '@/lib/receipt-printer-preference';
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { CheckoutRequestDetail } from '@/components/dashboard/checkout/CheckoutRequestDetail';
import { CheckoutRequestListCard } from '@/components/dashboard/checkout/CheckoutRequestListCard';
import {
  buildCheckoutSettlementSummary,
  checkoutPaymentProgress,
  checkoutSplitModeLabel,
  groupCollectedPaymentsBySession,
  hasCheckoutCollections,
} from '@/lib/checkout-settlement';
import { requestCheckoutRequestsQueue } from '@/lib/request-checkout-requests-queue';
import { useBillSplitsRealtimeRefresh } from '@/lib/use-bill-splits-realtime-refresh';

interface Props {
  initialRequests: BillSplit[];
  /** From server after loadDashboardAccess — Realtime filter + staff API scope. */
  restaurantId: string;
  /** Staff checkout requests API + print actions. */
  restaurantSlug: string;
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
  const supabase = useMemo(() => createClient(), []);
  const [selectedLines, setSelectedLines] = useState<CheckoutDisplayLine[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [collectedPaymentsBySession, setCollectedPaymentsBySession] = useState<
    Map<string, SessionCollectedPayment[]>
  >(() => new Map());
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
    try {
      const incoming = await requestCheckoutRequestsQueue(restaurantSlug);
      if (seq !== refreshSeqRef.current) return;
      setRequests((prev) => mergeBillSplitsFromRefresh(prev, incoming));
      invalidateCheckoutRequestCount();
    } catch {
      if (seq !== refreshSeqRef.current) return;
    }
  }, [restaurantSlug]);

  useBillSplitsRealtimeRefresh(
    supabase,
    restaurantId,
    `checkout-requests-${restaurantId}`,
    true,
    refreshCheckoutRequests,
  );

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
    const sessionIds = Array.from(
      new Set(
        requests
          .map((request) => request.session_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    if (!restaurantId || sessionIds.length === 0) {
      setCollectedPaymentsBySession(new Map());
      return;
    }

    let cancelled = false;
    const loadCollectedLedgers = async () => {
      const { data, error } = await supabase
        .from('session_collected_payments')
        .select(SESSION_COLLECTED_PAYMENT_SELECT)
        .eq('restaurant_id', restaurantId)
        .in('session_id', sessionIds)
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (error) {
        setCollectedPaymentsBySession(new Map());
        return;
      }

      setCollectedPaymentsBySession(
        groupCollectedPaymentsBySession(parseSessionCollectedPaymentsWithSession(data)),
      );
    };

    void loadCollectedLedgers();
    return () => {
      cancelled = true;
    };
  }, [supabase, restaurantId, requests]);

  const getDiscountRate = (request: BillSplit) =>
    billDiscount.getDisplayRate(request.id, request.discount_rate ?? 0);
  const getDiscountedSplitResult = (request: BillSplit) =>
    discountedSplitRows(request, getDiscountRate(request));

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

    const collectedByPerson = sumCollectedByPersonName(
      getCollectedForSession(request.session_id),
    );
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
          .select(SESSION_COLLECTED_PAYMENT_SELECT)
          .eq('restaurant_id', restaurantId)
          .eq('session_id', request.session_id)
          .order('created_at', { ascending: true });
        const payments = parseSessionCollectedPayments(data);
        setCollectedPaymentsBySession((prev) => {
          const next = new Map(prev);
          next.set(request.session_id as string, payments);
          return next;
        });
      }

      setRequests((prev) =>
        outcome.all_paid
          ? prev.filter((r) => r.id !== request.id)
          : prev.map((r) => (r.id === request.id ? { ...r, result: outcome.result } : r)),
      );
      invalidateCheckoutRequestCount();
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

  const splitModeLabels = useMemo(
    () => ({
      even: t.splitModeEven,
      byItem: t.splitModeByItem,
      custom: t.splitModeCustom,
      wholeTable: t.splitModeWhole,
    }),
    [t],
  );

  const getCollectedForSession = useCallback(
    (sessionId: string | null | undefined) => {
      if (!sessionId) return [];
      return collectedPaymentsBySession.get(sessionId) ?? [];
    },
    [collectedPaymentsBySession],
  );

  const getRequestCheckoutMeta = useCallback(
    (request: BillSplit) => {
      const collected = getCollectedForSession(request.session_id);
      const discountRate = billDiscount.getDisplayRate(request.id, request.discount_rate ?? 0);
      const summary = buildCheckoutSettlementSummary(request, discountRate, collected);
      const progress = checkoutPaymentProgress(request);
      const paymentProgressLabel =
        progress.totalCount > 1
          ? t.paymentProgress
              .replace('{paid}', String(progress.paidCount))
              .replace('{total}', String(progress.totalCount))
          : null;
      return {
        collected,
        summary,
        splitModeLabel: checkoutSplitModeLabel(request.split_mode, splitModeLabels),
        paymentProgressLabel,
        partialPaid: hasCheckoutCollections(request, collected),
      };
    },
    [billDiscount, getCollectedForSession, splitModeLabels, t],
  );

  const selectedCollectedPayments = useMemo(
    () => (selectedRequest ? getCollectedForSession(selectedRequest.session_id) : []),
    [selectedRequest, getCollectedForSession],
  );
  const selectedMeta = selectedRequest ? getRequestCheckoutMeta(selectedRequest) : null;

  const collectedByPerson = useMemo(
    () => sumCollectedByPersonName(selectedCollectedPayments),
    [selectedCollectedPayments],
  );
  const resumeBlockReason = selectedRequest
    ? resumeCheckoutBlockReason(selectedRequest, selectedCollectedPayments)
    : null;
  const resumeConfirmMessage = useMemo(() => {
    if (!selectedRequest) return t.resumeOrderingConfirmCancel;
    const variant = resumeOrderingConfirmVariant(selectedRequest, selectedCollectedPayments);
    if (variant === 'preserve_by_item') return t.resumeOrderingConfirmPreserveByItem;
    if (variant === 'preserve_with_collections') return t.resumeOrderingConfirmPreserveWithCollections;
    return t.resumeOrderingConfirmCancel;
  }, [selectedRequest, selectedCollectedPayments, t]);
  const pendingSplitRows = selectedRequest
    ? unpaidSplitRowsWithIndex(getDiscountedSplitResult(selectedRequest))
    : [];

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
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:gap-4 lg:items-start">
          <div
            className={`space-y-2 ${selectedRequestId ? 'hidden lg:block' : ''}`}
          >
            {requests.map((request) => {
              const meta = getRequestCheckoutMeta(request);
              return (
                <CheckoutRequestListCard
                  key={request.id}
                  request={request}
                  selected={request.id === selectedRequestId}
                  summary={meta.summary}
                  splitModeLabel={meta.splitModeLabel}
                  paymentProgressLabel={meta.paymentProgressLabel}
                  partialPaid={meta.partialPaid}
                  lang={lang}
                  t={t}
                  onSelect={() => setSelectedRequestId(request.id)}
                />
              );
            })}
          </div>

          <div className={selectedRequestId ? '' : 'hidden lg:block'}>
            {selectedRequest && selectedMeta ? (
              <CheckoutRequestDetail
                request={selectedRequest}
                summary={selectedMeta.summary}
                splitModeLabel={selectedMeta.splitModeLabel}
                partialPaid={selectedMeta.partialPaid}
                collectedPayments={selectedCollectedPayments}
                pendingSplitRows={pendingSplitRows}
                collectedByPerson={collectedByPerson}
                selectedLines={selectedLines}
                processingKeys={processingKeys}
                discountRate={getDiscountRate(selectedRequest)}
                discountApplying={billDiscount.applyingRequestId === selectedRequest.id}
                discountLocked={hasConfirmedPerson(selectedRequest)}
                resumeBlockReason={resumeBlockReason}
                canCloseTable={canCloseTable}
                printCooldownSeconds={cooldownSecondsLeft(selectedRequest.id)}
                printOnCooldown={isOnCooldown(selectedRequest.id)}
                showBackButton
                lang={lang}
                t={t}
                onBack={() => setSelectedRequestId(null)}
                onDiscountRateChange={(next) =>
                  billDiscount.handleRateChange(selectedRequest.id, next)
                }
                onDiscountRateFocus={() =>
                  billDiscount.handleRateFocus(
                    selectedRequest.id,
                    selectedRequest.discount_rate ?? 0,
                  )
                }
                onDiscountRateBlur={() => handleDiscountRateBlur(selectedRequest)}
                onConfirmPersonPaid={(index) =>
                  void handleConfirmPersonPaid(selectedRequest, index)
                }
                onPrintBill={() => void handlePrintBill(selectedRequest)}
                onResumeOrderingClick={() => setResumeConfirmOpen(true)}
                onCloseTable={() => {
                  setSelectedRequestId(null);
                  void refreshCheckoutRequests();
                }}
              />
            ) : (
              <div className="hidden lg:flex bg-brand-card border border-brand-border rounded-xl px-6 py-16 text-center items-center justify-center min-h-[240px]">
                <p className="text-brand-text-muted text-sm">{t.selectTableHint}</p>
              </div>
            )}
          </div>
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
        message={resumeConfirmMessage}
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
