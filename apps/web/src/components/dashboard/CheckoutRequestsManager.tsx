'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { BillSplit } from '@/types';
import { playCheckoutRequestChime } from '@/lib/checkout-notification-sound';
import {
  loadCheckoutSoundEnabled,
  saveCheckoutSoundEnabled,
} from '@/lib/receipt-printer-preference';
import { CheckoutRequestDetailHost } from '@/components/dashboard/checkout/CheckoutRequestDetailHost';
import { CheckoutRequestListCard } from '@/components/dashboard/checkout/CheckoutRequestListCard';
import {
  buildCheckoutSettlementSummary,
  checkoutPaymentProgress,
  checkoutSplitModeLabel,
  hasCheckoutCollections,
} from '@/lib/checkout-settlement';
import { useCheckoutBillDiscount } from '@/lib/checkout-discount/use-checkout-bill-discount';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { DashboardQuickNavLink } from '@/components/dashboard/DashboardQuickNavLink';
import { canAccessDashboardWaiterBoard } from '@/lib/dashboard-nav-config';
import { DASHBOARD_NAV_ITEMS } from '@/lib/dashboard-feature-registry';
import { waiterBoardHref } from '@/lib/staff-routes';
import type { DashboardAccessMode } from '@/lib/dashboard-access';
import {
  checkoutQueueFocusKey,
  hasCheckoutQueueFocus,
  resolveFocusedRequestId,
  type CheckoutQueueFocus,
} from '@/lib/checkout-queue-focus';

type CheckoutSelection =
  | { mode: 'follow_focus' }
  | { mode: 'picked'; requestId: string }
  | { mode: 'list' };

interface Props {
  restaurantId: string;
  restaurantSlug: string;
  accessMode: DashboardAccessMode;
  /** Owner or frontdesk may force-close unpaid tables from checkout. */
  canCloseTable?: boolean;
  /** URL intent: auto-open this checkout request after queue is fresh. */
  initialFocus?: CheckoutQueueFocus;
}

export function CheckoutRequestsManager({
  restaurantId,
  restaurantSlug,
  accessMode,
  canCloseTable = false,
  initialFocus,
}: Props) {
  const { requests, reload, getCollectedForSession } = useCheckoutRequests();
  const billDiscount = useCheckoutBillDiscount();
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const navT = getMessages(lang).nav;
  const showWaiterBoardLink = canAccessDashboardWaiterBoard(accessMode);
  const waiterBoardNav = DASHBOARD_NAV_ITEMS.waiterBoard;
  const [selection, setSelection] = useState<CheckoutSelection>({ mode: 'follow_focus' });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevRequestCountRef = useRef<number | null>(null);
  const reloadedFocusKeyRef = useRef('');

  const focusKey = checkoutQueueFocusKey(initialFocus);

  useEffect(() => {
    setSoundEnabled(loadCheckoutSoundEnabled());
  }, []);

  useEffect(() => {
    setSelection({ mode: 'follow_focus' });
  }, [focusKey]);

  useEffect(() => {
    if (!focusKey || reloadedFocusKeyRef.current === focusKey) return;
    reloadedFocusKeyRef.current = focusKey;
    void reload();
  }, [focusKey, reload]);

  const autoFocusedRequestId = useMemo(
    () => resolveFocusedRequestId(requests, initialFocus),
    [initialFocus, requests],
  );

  const selectedRequestId = useMemo(() => {
    if (selection.mode === 'picked') return selection.requestId;
    if (selection.mode === 'list') return null;
    return autoFocusedRequestId;
  }, [autoFocusedRequestId, selection]);

  useEffect(() => {
    const prev = prevRequestCountRef.current;
    prevRequestCountRef.current = requests.length;
    if (prev === null) return;
    if (soundEnabled && requests.length > prev) {
      playCheckoutRequestChime();
    }
  }, [requests.length, soundEnabled]);

  useEffect(() => {
    if (!selectedRequestId) return;
    if (!requests.some((row) => row.id === selectedRequestId)) {
      setSelection({ mode: 'follow_focus' });
    }
  }, [requests, selectedRequestId]);

  const pendingLabel = t.pendingBadge.replace('{n}', String(requests.length));
  const selectedRequest = selectedRequestId
    ? requests.find((row) => row.id === selectedRequestId)
    : undefined;
  const awaitingFocusResolve =
    hasCheckoutQueueFocus(initialFocus) && selection.mode === 'follow_focus' && !selectedRequest;

  const splitModeLabels = useMemo(
    () => ({
      even: t.splitModeEven,
      byItem: t.splitModeByItem,
      custom: t.splitModeCustom,
      wholeTable: t.splitModeWhole,
    }),
    [t],
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

  const selectRequest = useCallback((requestId: string) => {
    setSelection({ mode: 'picked', requestId });
  }, []);

  const showList = useCallback(() => {
    setSelection({ mode: 'list' });
  }, []);

  const clearSelectionAfterComplete = useCallback(() => {
    setSelection({ mode: 'follow_focus' });
  }, []);

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
          <div className="flex flex-wrap items-center justify-end gap-3">
            {showWaiterBoardLink ? (
              <DashboardQuickNavLink
                href={waiterBoardHref(restaurantSlug, { embeddedInDashboard: true })}
                icon={waiterBoardNav.icon}
                label={navT.viewWaiter}
              />
            ) : null}
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
          <div className={`space-y-2 ${selectedRequestId ? 'hidden lg:block' : ''}`}>
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
                  onSelect={() => selectRequest(request.id)}
                />
              );
            })}
          </div>

          <div className={selectedRequestId ? '' : 'hidden lg:block'}>
            {selectedRequest ? (
              <CheckoutRequestDetailHost
                key={selectedRequest.id}
                request={selectedRequest}
                restaurantId={restaurantId}
                restaurantSlug={restaurantSlug}
                canCloseTable={canCloseTable}
                showBackButton={!!selectedRequestId}
                onBack={showList}
                onAllPaid={clearSelectionAfterComplete}
                onCloseTableComplete={clearSelectionAfterComplete}
                onResumeOrderingComplete={clearSelectionAfterComplete}
              />
            ) : awaitingFocusResolve ? (
              <div className="flex bg-brand-card border border-brand-border rounded-xl px-6 py-16 text-center items-center justify-center min-h-[240px]">
                <p className="text-brand-text-muted text-sm">{t.selectTableHint}</p>
              </div>
            ) : (
              <div className="hidden lg:flex bg-brand-card border border-brand-border rounded-xl px-6 py-16 text-center items-center justify-center min-h-[240px]">
                <p className="text-brand-text-muted text-sm">{t.selectTableHint}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
