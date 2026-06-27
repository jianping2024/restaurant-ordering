'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Buffet, Order } from '@/types';
import {
  aggregateBuffetForOrders,
  buildBuffetBaseLine,
  formatBuffetPriceTemplate,
  isBuffetGuestCountsUnchanged,
  parseResolvedBuffetPriceRpcRow,
  resolveBuffetOpenPricePreview,
  type ResolvedBuffetPriceRow,
} from '@/lib/buffet-order';
import {
  applyBuffetOpenOptimisticToOrders,
  OPTIMISTIC_OPEN_SESSION_ID,
} from '@/lib/buffet-open-table';
import { ordersForWaiterTableView } from '@/lib/waiter-table-orders';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { StaffRoleToolbar } from '@/components/staff/StaffRoleToolbar';
import { UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { VoidItemReasonDialog } from '@/lib/order-item-void/VoidItemReasonDialog';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { showToast } from '@/components/ui/Toast';
import { coerceCartQty } from '@/lib/cart-totals';
import { applyOrderItemDecrement } from '@/lib/order-item-void/decrement-order-item';
import { computeOrderTotalsFromItems } from '@/lib/order-item-void/persist-order-items-update';
import { voidItemReasonErrorMessage } from '@/lib/order-item-void/void-item-reason-ui';
import { WaiterAuthenticatedShell } from '@/components/waiter/WaiterAuthenticatedShell';
import { useWaiterTableDetail } from '@/components/waiter/useWaiterTableDetail';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { buildWaiterTableCard } from '@/components/waiter/waiter-table-card';
import { isWaiterTableCardOccupied } from '@/lib/waiter-table-occupancy';
import { waiterUi } from '@/components/waiter/waiter-ui';
import { useBuffetPricesRealtimeRefresh } from '@/lib/use-buffet-prices-realtime-refresh';
import { WaiterOrderQtyMinus } from '@/components/waiter/WaiterOrderQtyMinus';
import { postWaiterDecrementOrderItemClient } from '@/lib/waiter-decrement-order-item-client';
import { fetchWaiterTableActionTargetsClient, postWaiterBuffetOpenClient } from '@/lib/staff-board-client';
import { tableIdsEqual, type RestaurantTableRow } from '@/lib/restaurant-tables';
import { waiterBoardHref, waiterTableHref, waiterMenuHref } from '@/lib/staff-routes';
import { requestDashboardCheckoutRequest } from '@/lib/request-dashboard-checkout-request';
import type { WaiterTableDetailData } from '@/lib/staff-board';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import { CloseTableSessionAction } from '@/components/dashboard/CloseTableSessionAction';

interface Props {
  restaurant: { id: string; name: string; slug: string };
  /** Demo only — all configured tables for transfer/merge UI. */
  tables?: RestaurantTableRow[];
  /** Demo only — full demo order set. */
  initialOrders?: Order[];
  initialTableDetail?: {
    table?: RestaurantTableRow | null;
    orders?: Order[];
    sessionMeta?: WaiterTableSessionMeta | null;
    checkoutRequested?: boolean;
    checkoutRequestedAt?: string | null;
  };
  initialBuffets?: Buffet[];
  tableId: string;
  displayName?: string;
  isDemo?: boolean;
  itemCodeByMenuId?: Record<string, string>;
  embeddedInDashboard?: boolean;
}

function WaiterTableDetailInner({
  restaurant,
  tables: demoTablesProp = [],
  initialOrders = [],
  initialTableDetail,
  initialBuffets = [],
  tableId,
  displayName = '',
  isDemo = false,
  itemCodeByMenuId = {},
  embeddedInDashboard = false,
  handleSignOut,
  exitLabel,
}: Props & { handleSignOut: () => void; exitLabel: string }) {
  const router = useRouter();
  const { lang } = useLanguage();
  const locale = UI_LOCALE_BY_LANG[lang];
  const t = WAITER_TEXT[lang];
  const initialDetail = initialTableDetail?.table ? initialTableDetail : null;
  const {
    table: selectedTable,
    orders,
    refresh,
    applyDetail,
    sessionMeta,
    checkoutRequestedAt,
    supabase,
    detailLoaded,
    activeSessionByTableId,
    checkoutRequested: isCheckoutPending,
    demoTables,
  } = useWaiterTableDetail(
    restaurant,
    tableId,
    initialDetail,
    !isDemo,
    isDemo,
    demoTablesProp,
    initialOrders,
  );

  const [operationType, setOperationType] = useState<'transfer' | 'merge' | null>(null);
  const [sourceTable, setSourceTable] = useState<string | null>(null);
  const [targetTable, setTargetTable] = useState<string | null>(null);
  const [actionTargets, setActionTargets] = useState<RestaurantTableRow[]>([]);
  const [actionTargetsLoading, setActionTargetsLoading] = useState(false);
  const [operating, setOperating] = useState(false);
  const [closingDemoTable, setClosingDemoTable] = useState<string | null>(null);
  const [demoCloseConfirmTableId, setDemoCloseConfirmTableId] = useState<string | null>(null);
  const [decrementingKey, setDecrementingKey] = useState<string | null>(null);
  const [pendingVoidDecrement, setPendingVoidDecrement] = useState<{
    orderId: string;
    itemIdx: number;
    order: Order;
  } | null>(null);
  const [voidReasonError, setVoidReasonError] = useState<string | null>(null);
  const [voidingDecrement, setVoidingDecrement] = useState(false);
  const [callingBill, setCallingBill] = useState(false);
  const activeBuffets = useMemo(() => initialBuffets.filter((b) => b.is_active), [initialBuffets]);
  const [buffetId, setBuffetId] = useState<string>(() => activeBuffets[0]?.id || '');
  const selectedBuffet = useMemo(
    () => activeBuffets.find((b) => b.id === buffetId) ?? activeBuffets[0] ?? null,
    [activeBuffets, buffetId],
  );
  const [buffetAdults, setBuffetAdults] = useState(2);
  const [buffetChildren, setBuffetChildren] = useState(0);
  const [buffetSubmitting, setBuffetSubmitting] = useState(false);
  const [buffetResolved, setBuffetResolved] = useState<ResolvedBuffetPriceRow | null>(null);
  const [buffetPriceLoading, setBuffetPriceLoading] = useState(false);
  const refreshBuffetPrices = useCallback(
    async (silent: boolean) => {
      if (isDemo || !buffetId) return;
      if (!silent) setBuffetPriceLoading(true);
      const { data: priceRows, error } = await supabase.rpc('resolve_buffet_prices', {
        p_restaurant_id: restaurant.id,
        p_buffet_id: buffetId,
        p_at: new Date().toISOString(),
      });
      if (!silent) setBuffetPriceLoading(false);
      if (error) {
        if (!silent) setBuffetResolved(null);
        return;
      }
      setBuffetResolved(parseResolvedBuffetPriceRpcRow(priceRows));
    },
    [isDemo, buffetId, restaurant.id, supabase],
  );

  useBuffetPricesRealtimeRefresh(supabase, restaurant.id, !isDemo && !!buffetId, () => void refreshBuffetPrices(true));

  /** Clock-driven slot turnover has no DB event; refresh at most once per minute while the tab is visible. */
  useEffect(() => {
    if (isDemo || !buffetId) {
      setBuffetResolved(null);
      setBuffetPriceLoading(false);
      return;
    }

    let cancelled = false;
    let minuteTimer: number | null = null;

    const clearMinute = () => {
      if (minuteTimer != null) {
        window.clearTimeout(minuteTimer);
        minuteTimer = null;
      }
    };

    const scheduleMinute = () => {
      clearMinute();
      if (cancelled || document.visibilityState !== 'visible') return;
      const jitterMs = 20;
      const ms = Math.max(jitterMs, 60_000 - (Date.now() % 60_000) + jitterMs);
      minuteTimer = window.setTimeout(async () => {
        minuteTimer = null;
        if (cancelled || document.visibilityState !== 'visible') return;
        await refreshBuffetPrices(true);
        scheduleMinute();
      }, ms);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshBuffetPrices(true);
        scheduleMinute();
      } else {
        clearMinute();
      }
    };

    void refreshBuffetPrices(false);

    document.addEventListener('visibilitychange', onVisibility);
    if (document.visibilityState === 'visible') scheduleMinute();

    return () => {
      cancelled = true;
      clearMinute();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isDemo, buffetId, refreshBuffetPrices]);

  const buffetPriceDisplay = useMemo(
    () => resolveBuffetOpenPricePreview(buffetResolved, buffetAdults, buffetChildren),
    [buffetResolved, buffetAdults, buffetChildren],
  );

  const bumpBuffetCount = (which: 'adults' | 'children', delta: number) => {
    const setter = which === 'adults' ? setBuffetAdults : setBuffetChildren;
    setter((n) => Math.max(0, n + delta));
  };

  useEffect(() => {
    if (activeBuffets.length === 0) return;
    if (!buffetId || !activeBuffets.some((b) => b.id === buffetId)) {
      setBuffetId(activeBuffets[0].id);
    }
  }, [activeBuffets, buffetId]);

  const selectedDisplayName = selectedTable?.display_name || displayName;

  const selectedCard = useMemo(
    () => buildWaiterTableCard(tableId, selectedDisplayName, orders, itemCodeByMenuId),
    [orders, tableId, selectedDisplayName, itemCodeByMenuId],
  );

  const wasCheckoutPendingRef = useRef(isCheckoutPending);
  useEffect(() => {
    if (!wasCheckoutPendingRef.current && isCheckoutPending) {
      showToast(t.checkoutToast.replace('{table}', selectedDisplayName), 'info');
    }
    wasCheckoutPendingRef.current = isCheckoutPending;
  }, [isCheckoutPending, selectedDisplayName, t.checkoutToast]);

  const notifyCheckoutLocked = useCallback(() => {
    showToast(t.checkoutLockedHint, 'info');
  }, [t.checkoutLockedHint]);

  const checkoutLockedClass = isCheckoutPending ? 'opacity-50 cursor-not-allowed' : '';

  const currentTableDetail = useCallback(
    (): WaiterTableDetailData => ({
      table: selectedTable,
      orders,
      sessionMeta,
      checkoutRequested: isCheckoutPending,
      checkoutRequestedAt,
    }),
    [checkoutRequestedAt, isCheckoutPending, orders, selectedTable, sessionMeta],
  );

  const tableBuffetAggregate = useMemo(
    () => aggregateBuffetForOrders(orders),
    [orders],
  );
  const buffetActionLabel = tableBuffetAggregate ? t.buffetSaveGuestCounts : t.buffetConfirm;

  const persistedBuffetId = tableBuffetAggregate?.buffetId;
  const persistedBuffetAdults = tableBuffetAggregate?.adults;
  const persistedBuffetChildren = tableBuffetAggregate?.children;

  /** Sync form when persisted headcount changes — not on every orders refresh (object identity). */
  useEffect(() => {
    if (
      persistedBuffetId === undefined ||
      persistedBuffetAdults === undefined ||
      persistedBuffetChildren === undefined
    ) {
      return;
    }
    setBuffetId(persistedBuffetId);
    setBuffetAdults(persistedBuffetAdults);
    setBuffetChildren(persistedBuffetChildren);
  }, [persistedBuffetId, persistedBuffetAdults, persistedBuffetChildren]);

  const demoActiveTableIds = useMemo(() => {
    if (!isDemo) return [] as string[];
    return demoTables
      .filter((table) => {
        const view = ordersForWaiterTableView(table.id, initialOrders, activeSessionByTableId);
        const c = buildWaiterTableCard(table.id, table.display_name, view, itemCodeByMenuId);
        return isWaiterTableCardOccupied(c);
      })
      .map((row) => row.id);
  }, [activeSessionByTableId, demoTables, initialOrders, isDemo, itemCodeByMenuId]);

  const demoTargetCandidates = useMemo(() => {
    if (!isDemo || !operationType || !sourceTable) return [] as RestaurantTableRow[];
    return operationType === 'transfer'
      ? demoTables.filter(
          (table) =>
            !demoActiveTableIds.includes(table.id) &&
            !tableIdsEqual(table.id, sourceTable),
        )
      : demoTables.filter(
          (table) =>
            demoActiveTableIds.includes(table.id) &&
            !tableIdsEqual(table.id, sourceTable),
        );
  }, [demoActiveTableIds, demoTables, isDemo, operationType, sourceTable]);

  const targetCandidates = isDemo ? demoTargetCandidates : actionTargets;

  const sourceTableLabel =
    (isDemo ? demoTables : actionTargets)
      .find((row) => tableIdsEqual(row.id, sourceTable ?? ''))?.display_name
    ?? selectedTable?.display_name
    ?? sourceTable
    ?? '';

  const routeOptions = useMemo(
    () => ({ isDemo, embeddedInDashboard }),
    [isDemo, embeddedInDashboard],
  );
  const pageShellClass = embeddedInDashboard ? '' : 'min-h-screen bg-brand-bg p-4';
  const boardHref = waiterBoardHref(restaurant.slug, routeOptions);
  const menuHref = waiterMenuHref(restaurant.slug, tableId, routeOptions);

  const openAction = (type: 'transfer' | 'merge', sourceId: string) => {
    if (tableIdsEqual(sourceId, tableId) && isCheckoutPending) {
      notifyCheckoutLocked();
      return;
    }
    setOperationType(type);
    setSourceTable(sourceId);
    setTargetTable(null);
    setActionTargets([]);
    if (isDemo) return;

    setActionTargetsLoading(true);
    void fetchWaiterTableActionTargetsClient(restaurant.slug, tableId, type)
      .then(setActionTargets)
      .catch(() => {
        showToast(t.actionFailed, 'error');
        setOperationType(null);
        setSourceTable(null);
      })
      .finally(() => setActionTargetsLoading(false));
  };

  const closeAction = () => {
    setOperationType(null);
    setSourceTable(null);
    setTargetTable(null);
    setActionTargets([]);
    setActionTargetsLoading(false);
    setOperating(false);
  };

  const goToTableDetail = useCallback(
    (targetTableId: string) => {
      router.replace(waiterTableHref(restaurant.slug, targetTableId, routeOptions));
    },
    [routeOptions, restaurant.slug, router],
  );

  const finishTransferOrMerge = useCallback(
    async (targetTableId: string, operation: 'transfer' | 'merge', targetLabel: string) => {
      await refresh();
      const toastText =
        operation === 'transfer'
          ? t.transferDone.replace('{table}', targetLabel)
          : t.mergeDone.replace('{table}', targetLabel);
      closeAction();
      showToast(toastText, 'success');
      goToTableDetail(targetTableId);
    },
    [refresh, t.transferDone, t.mergeDone, goToTableDetail],
  );

  const handleActionSubmit = async () => {
    if (!operationType || !sourceTable || !targetTable) return;
    if (isCheckoutPending) {
      notifyCheckoutLocked();
      return;
    }
    if (tableIdsEqual(sourceTable, targetTable)) {
      showToast(t.sameTableError, 'error');
      return;
    }

    const currentOperation = operationType;
    const fromTable = sourceTable;
    const toTable = targetTable;
    setOperating(true);
    try {
      if (!isDemo) {
        const res = await fetch(
          `/api/restaurants/${encodeURIComponent(restaurant.slug)}/staff/waiter/tables/action`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: currentOperation,
              from_table_id: fromTable,
              to_table_id: toTable,
            }),
          },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (data.error === 'session_billing') {
            notifyCheckoutLocked();
          } else {
            showToast(t.actionFailed, 'error');
          }
          return;
        }
        await finishTransferOrMerge(
          toTable,
          currentOperation,
          targetCandidates.find((row) => tableIdsEqual(row.id, toTable))?.display_name ?? toTable,
        );
        return;
      }

      const { data: rpcResult, error } = currentOperation === 'transfer'
        ? await supabase.rpc('transfer_table_session', {
          p_restaurant_id: restaurant.id,
          p_from_table_id: fromTable,
          p_to_table_id: toTable,
        })
        : await supabase.rpc('merge_table_sessions', {
          p_restaurant_id: restaurant.id,
          p_source_table_id: fromTable,
          p_target_table_id: toTable,
        });

      if (error) {
        if ((error.message || '').toLowerCase().includes('active session')) {
          showToast(t.refreshHint, 'error');
        } else {
          showToast(t.actionFailed, 'error');
        }
        return;
      }

      const sessionCheck = await supabase
        .from('table_sessions')
        .select('id, table_id, status')
        .eq('id', rpcResult as string)
        .in('status', ['open', 'billing'])
        .maybeSingle();

      if (sessionCheck.error || !sessionCheck.data || !tableIdsEqual(sessionCheck.data.table_id, toTable)) {
        showToast(t.refreshHint, 'error');
        return;
      }

      await finishTransferOrMerge(
        toTable,
        currentOperation,
        targetCandidates.find((row) => tableIdsEqual(row.id, toTable))?.display_name ?? toTable,
      );
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      setOperating(false);
    }
  };

  const demoCloseConfirmCopy = useMemo(
    () => ({
      title: t.closeTableConfirmTitle,
      message: t.closeTableConfirmMessage,
    }),
    [t],
  );

  if (!isDemo && !detailLoaded) {
    return (
      <div className={pageShellClass}>
        <div className="mb-6">
          <Link href={boardHref} className={waiterUi.navLink}>
            ← {t.backToBoard}
          </Link>
          {embeddedInDashboard ? (
            <h1 className="font-heading text-2xl text-brand-gold mt-2">
              {t.detailsTitle} · {t.table} …
            </h1>
          ) : null}
        </div>
        {embeddedInDashboard ? (
          <p className="text-sm text-brand-text-muted" aria-busy="true">
            {t.tableDetailLoading}
          </p>
        ) : (
          <>
            <div
              className="rounded-2xl border border-brand-border/50 bg-brand-card/70 p-6 animate-pulse"
              aria-busy="true"
              aria-label={t.tableDetailLoading}
            >
              <div className="h-5 w-48 rounded bg-brand-border/60 mb-4" />
              <div className="h-24 rounded bg-brand-border/40" />
            </div>
            <p className="text-sm text-brand-text-muted mt-3">{t.tableDetailLoading}</p>
          </>
        )}
      </div>
    );
  }

  if (!isDemo && detailLoaded && !selectedTable) {
    return (
      <div className={pageShellClass}>
        {!embeddedInDashboard ? (
          <StaffRoleToolbar exitLabel={exitLabel} onSignOut={handleSignOut} />
        ) : null}
        <div className="mt-6 rounded-xl border border-brand-border bg-brand-card p-4 text-sm text-brand-text-muted">
          {t.noOrdersOnTable}
        </div>
        <Link
          href={boardHref}
          className="mt-4 inline-flex text-sm text-brand-gold hover:text-brand-gold-light"
        >
          {t.backToBoard}
        </Link>
      </div>
    );
  }

  const closeDemoTable = async (closeTableId: string) => {
    setClosingDemoTable(closeTableId);
    try {
      const { data: session, error: findError } = await supabase
        .from('table_sessions')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .eq('table_id', closeTableId)
        .in('status', ['open', 'billing'])
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError || !session?.id) {
        showToast(t.closeTableNoSession, 'error');
        return;
      }

      const { error: updError } = await supabase
        .from('table_sessions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_reason: 'waiter_closed',
        })
        .eq('id', session.id);

      if (updError) {
        showToast(t.actionFailed, 'error');
        return;
      }

      await refresh();
      showToast(t.actionSuccess, 'success');
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      setClosingDemoTable(null);
    }
  };

  const handleCallBill = async () => {
    if (isDemo || !embeddedInDashboard || isCheckoutPending) return;
    if (!isWaiterTableCardOccupied(selectedCard)) {
      showToast(t.noOrdersOnTable, 'info');
      return;
    }
    setCallingBill(true);
    try {
      const result = await requestDashboardCheckoutRequest(tableId);
      if (!result.ok) {
        if (result.error === 'session_billing') showToast(t.checkoutLockedHint, 'info');
        else showToast(t.actionFailed, 'error');
        return;
      }
      await refresh();
      showToast(t.callBillSuccess, 'success');
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      setCallingBill(false);
    }
  };

  const showFrontdeskCloseTable = embeddedInDashboard;
  const showFrontdeskCallBill =
    embeddedInDashboard && !isCheckoutPending && isWaiterTableCardOccupied(selectedCard);

  const applyBuffetToTable = async () => {
    if (!buffetId) return;
    if (isCheckoutPending) {
      notifyCheckoutLocked();
      return;
    }

    if (!selectedBuffet) return;

    if (isBuffetGuestCountsUnchanged(orders, buffetId, buffetAdults, buffetChildren)) {
      showToast(t.buffetGuestCountsUnchanged, 'info');
      return;
    }

    if (!buffetResolved) {
      showToast(t.buffetNoRule, 'error');
      return;
    }

    const line = buildBuffetBaseLine({
      buffet: selectedBuffet,
      adultCount: buffetAdults,
      childCount: buffetChildren,
      resolved: buffetResolved,
    });
    if (!line) {
      showToast(t.buffetNoRule, 'error');
      return;
    }

    const rollbackDetail = currentTableDetail();

    const optimisticSessionId = sessionMeta?.sessionId ?? OPTIMISTIC_OPEN_SESSION_ID;
    applyDetail({
      ...rollbackDetail,
      orders: applyBuffetOpenOptimisticToOrders(orders, {
        tableId,
        displayName: selectedDisplayName,
        line,
        restaurantId: restaurant.id,
        sessionId: optimisticSessionId,
      }),
    });

    setBuffetSubmitting(true);
    try {
      const detail = await postWaiterBuffetOpenClient(restaurant.slug, {
        table_id: tableId,
        buffet_id: buffetId,
        adult_count: buffetAdults,
        child_count: buffetChildren,
      });
      applyDetail(detail);
      showToast(t.actionSuccess, 'success');
    } catch (err) {
      const apiErr = err as Error & { status?: number; code?: string };
      if (apiErr.status === 409 && apiErr.code === 'session_billing') {
        applyDetail(rollbackDetail);
        showToast(t.checkoutLockedHint, 'info');
        return;
      }
      if (apiErr.status === 409) {
        await refresh();
        showToast(t.refreshHint, 'error');
        return;
      }
      if (apiErr.status === 400 && apiErr.code === 'no_price_rule') {
        applyDetail(rollbackDetail);
        showToast(t.buffetNoRule, 'error');
        return;
      }
      applyDetail(rollbackDetail);
      showToast(t.actionFailed, 'error');
    } finally {
      setBuffetSubmitting(false);
    }
  };

  const orderLineKey = (orderId: string, itemIdx: number) => `${orderId}:${itemIdx}`;

  const executeDecrementOrderLine = async (
    orderId: string,
    itemIdx: number,
    order: Order,
    voidReason?: string,
    voidReasonDetail?: string,
  ) => {
    const key = orderLineKey(orderId, itemIdx);
    setDecrementingKey(key);
    try {
      if (!isDemo) {
        const { outcome } = await postWaiterDecrementOrderItemClient(restaurant.slug, orderId, {
          item_index: itemIdx,
          updated_at: order.updated_at,
          ...(voidReason ? { void_reason: voidReason, void_reason_detail: voidReasonDetail } : {}),
        });
        await refresh();
        if (outcome === 'voided') {
          showToast(t.voidedLabel, 'success');
        }
        return;
      }

      const applied = applyOrderItemDecrement(order.items, itemIdx, order.status);
      if (!applied.ok) {
        showToast(t.actionFailed, 'error');
        return;
      }

      const { nextStatus, total_amount } = computeOrderTotalsFromItems(
        applied.nextItems,
        order.status,
      );
      const { error } = await supabase
        .from('orders')
        .update({
          items: applied.nextItems,
          status: nextStatus,
          total_amount,
        })
        .eq('id', orderId)
        .eq('updated_at', order.updated_at);

      if (error) {
        showToast(t.refreshHint, 'error');
        await refresh();
        return;
      }

      await refresh();
      if (applied.outcome === 'voided') {
        showToast(t.voidedLabel, 'success');
      }
    } catch (err) {
      const apiErr = err as Error & { status?: number; code?: string };
      if (apiErr.status === 409 && apiErr.code === 'session_billing') {
        notifyCheckoutLocked();
        return;
      }
      if (apiErr.status === 409) {
        showToast(t.refreshHint, 'error');
        await refresh();
        return;
      }
      const reasonMessage = voidItemReasonErrorMessage(lang, apiErr.code);
      if (reasonMessage) {
        throw err;
      }
      showToast(t.actionFailed, 'error');
    } finally {
      setDecrementingKey(null);
    }
  };

  const handleDecrementOrderLine = (orderId: string, itemIdx: number) => {
    if (isCheckoutPending) {
      notifyCheckoutLocked();
      return;
    }
    const order = orders.find((row) => row.id === orderId);
    if (!order) return;
    const item = order.items[itemIdx];
    if (!item) return;

    if (coerceCartQty(item.qty) <= 1 && !isDemo) {
      setVoidReasonError(null);
      setPendingVoidDecrement({ orderId, itemIdx, order });
      return;
    }

    void executeDecrementOrderLine(orderId, itemIdx, order);
  };

  const performVoidDecrement = async (reason: string, detail: string) => {
    if (!pendingVoidDecrement) return;
    const { orderId, itemIdx, order } = pendingVoidDecrement;
    setVoidingDecrement(true);
    setVoidReasonError(null);
    try {
      await executeDecrementOrderLine(orderId, itemIdx, order, reason, detail || undefined);
      setPendingVoidDecrement(null);
    } catch (err) {
      const apiErr = err as Error & { code?: string };
      const message = voidItemReasonErrorMessage(lang, apiErr.code);
      if (message) {
        setVoidReasonError(message);
        return;
      }
      showToast(t.actionFailed, 'error');
    } finally {
      setVoidingDecrement(false);
    }
  };

  const tableUpdatedLabel = selectedCard.updatedAt
    ? new Date(selectedCard.updatedAt).toLocaleString(locale, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    : '-';

  return (
    <div className={pageShellClass}>
      {isDemo && (
        <div className="mb-4 rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3">
          <p className="text-[13px] text-brand-text">
            {t.step}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/demo/menu"
              className={waiterUi.navLink}
            >
              {t.openCustomer}
            </Link>
            <Link
              href="/demo/kitchen"
              className={waiterUi.navLink}
            >
              {t.openKitchen}
            </Link>
            <Link
              href="/demo"
              className={waiterUi.navLink}
            >
              {t.backHub}
            </Link>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className={`flex flex-wrap justify-between items-center gap-2 ${embeddedInDashboard ? '' : 'mb-3'}`}>
          <Link
            href={boardHref}
            className={waiterUi.navLink}
          >
            ← {t.backToBoard}
          </Link>
          {!embeddedInDashboard ? (
            <StaffRoleToolbar exitLabel={exitLabel} onSignOut={handleSignOut} className="mb-0" />
          ) : null}
        </div>
        {!embeddedInDashboard ? (
          <>
            <h1 className="font-heading text-3xl text-brand-gold">{restaurant.name}</h1>
            <p className="text-brand-text-muted text-sm mt-1">{t.boardTitle}</p>
          </>
        ) : (
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h1 className="font-heading text-2xl text-brand-gold">
              {t.detailsTitle} · {t.table} {selectedCard.displayName}
            </h1>
            <span className="text-[13px] text-brand-text-muted tabular-nums">{tableUpdatedLabel}</span>
          </div>
        )}
      </div>

      <div
        className={
          embeddedInDashboard
            ? 'space-y-4'
            : 'rounded-2xl p-4 border border-brand-border/50 bg-brand-card shadow-sm shadow-black/5'
        }
      >
        {!embeddedInDashboard ? (
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-2xl text-brand-text">
              {t.detailsTitle} - {t.table} {selectedCard.displayName}
            </h2>
            <span className="text-[13px] text-brand-text-muted tabular-nums">{tableUpdatedLabel}</span>
          </div>
        ) : null}

        {isCheckoutPending && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-amber-500/45 bg-amber-500/12 px-3 py-2.5"
          >
            <p className="text-[13px] font-medium text-amber-950/95 dark:text-amber-100/95 leading-snug">
              {t.checkoutPendingBanner}
            </p>
          </div>
        )}

        {activeBuffets.length > 0 && !isDemo && !isCheckoutPending && (
          <div className="mb-4 rounded-xl border border-brand-gold/30 bg-brand-gold/8 p-3.5 space-y-3">
            {activeBuffets.length === 1 ? (
              <p className="text-[15px] font-medium text-brand-text leading-snug">{selectedBuffet?.name}</p>
            ) : (
              <select
                value={buffetId}
                onChange={(e) => setBuffetId(e.target.value)}
                aria-label={t.buffetBlock}
                className="block w-full rounded-lg bg-brand-bg border border-brand-border px-2.5 py-2 text-[15px] font-medium text-brand-text"
              >
                {activeBuffets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            {buffetPriceLoading ? (
              <p className="text-[13px] text-brand-text-muted">{t.buffetPriceLoading}</p>
            ) : buffetPriceDisplay.ok ? (
              <p className="text-[13px] leading-snug text-brand-text-muted">
                {formatBuffetPriceTemplate(t.buffetPriceRatesLine, {
                  adultPrice: buffetPriceDisplay.adultPrice,
                  childPrice: buffetPriceDisplay.childPrice,
                })}
              </p>
            ) : (
              <p className="text-[13px] mesa-text-warning">{t.buffetNoRule}</p>
            )}

            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-brand-text min-w-[2rem]">{t.buffetAdults}</span>
                <CartQtyStepper
                  variant="drawer"
                  qty={buffetAdults}
                  onDecrement={() => bumpBuffetCount('adults', -1)}
                  onIncrement={() => bumpBuffetCount('adults', 1)}
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-brand-text min-w-[2rem]">{t.buffetChildren}</span>
                <CartQtyStepper
                  variant="drawer"
                  qty={buffetChildren}
                  onDecrement={() => bumpBuffetCount('children', -1)}
                  onIncrement={() => bumpBuffetCount('children', 1)}
                />
              </div>
            </div>

            {buffetPriceDisplay.ok && (
              <p className="text-[15px] font-semibold text-brand-text tabular-nums">
                {formatBuffetPriceTemplate(t.buffetEstimatedTotal, {
                  total: buffetPriceDisplay.subtotal,
                })}
              </p>
            )}

            <button
              type="button"
              onClick={() => void applyBuffetToTable()}
              disabled={buffetSubmitting || buffetPriceLoading || !buffetPriceDisplay.ok}
              className={`${waiterUi.btnPrimary} w-full justify-center disabled:opacity-50`}
            >
              {buffetSubmitting ? '…' : buffetActionLabel}
            </button>
          </div>
        )}

        {isWaiterTableCardOccupied(selectedCard) && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {selectedCard.hasBuffet && (
                isCheckoutPending ? (
                  <button
                    type="button"
                    onClick={notifyCheckoutLocked}
                    className={`${waiterUi.btnPrimary} mr-1 ${checkoutLockedClass}`}
                  >
                    + {t.addDish}
                  </button>
                ) : (
                  <Link href={menuHref} className={`${waiterUi.btnPrimary} mr-1`}>
                    + {t.addDish}
                  </Link>
                )
              )}
              <button
                type="button"
                onClick={() => openAction('transfer', selectedCard.tableId)}
                className={`${waiterUi.btnSecondary} ${waiterUi.btnWarm} ${checkoutLockedClass}`}
              >
                {t.transfer}
              </button>
              <button
                type="button"
                onClick={() => openAction('merge', selectedCard.tableId)}
                className={`${waiterUi.btnSecondary} ${waiterUi.btnGhost} ${checkoutLockedClass}`}
              >
                {t.merge}
              </button>
              {showFrontdeskCallBill ? (
                <button
                  type="button"
                  onClick={() => void handleCallBill()}
                  disabled={callingBill}
                  className={`${waiterUi.btnSecondary} ${waiterUi.btnWarm} disabled:opacity-50`}
                >
                  {callingBill ? t.callBillOperating : t.callBill}
                </button>
              ) : null}
              {showFrontdeskCloseTable ? (
                isDemo ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isCheckoutPending) {
                        void closeDemoTable(selectedCard.tableId);
                        return;
                      }
                      setDemoCloseConfirmTableId(selectedCard.tableId);
                    }}
                    disabled={closingDemoTable === selectedCard.tableId}
                    className={`${waiterUi.btnSecondary} ${waiterUi.btnDanger} disabled:opacity-50`}
                  >
                    {closingDemoTable === selectedCard.tableId ? t.closeTableOperating : t.closeTable}
                  </button>
                ) : (
                  <CloseTableSessionAction
                    tableId={selectedCard.tableId}
                    isCheckoutPending={isCheckoutPending}
                    onClosed={() => {
                      void refresh();
                    }}
                    className={`${waiterUi.btnSecondary} ${waiterUi.btnDanger} disabled:opacity-50`}
                  />
                )
              ) : null}
            </div>

            {selectedCard.orderLines.length > 0 && (
              <div className="rounded-lg border border-brand-border/60 p-2.5 space-y-2 mb-3">
                {selectedCard.orderLines.map((line) => (
                  <div key={`${line.orderId}-${line.itemIdx}`} className="flex items-center justify-between gap-2">
                    <p className="text-sm text-brand-text truncate min-w-0 flex-1">
                      {line.itemCode && (
                        <span className="font-mono text-[11px] text-brand-gold tabular-nums mr-1">[{line.itemCode}]</span>
                      )}
                      {line.label}
                    </p>
                    {(line.quantityLabel || line.canDecrement) && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {line.quantityLabel && (
                          <span className="text-sm text-brand-text tabular-nums">{line.quantityLabel}</span>
                        )}
                        {line.canDecrement && (
                          <WaiterOrderQtyMinus
                            onDecrement={() => void handleDecrementOrderLine(line.orderId, line.itemIdx)}
                            disabled={isCheckoutPending}
                            busy={decrementingKey === orderLineKey(line.orderId, line.itemIdx)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={!!operationType}
        onClose={closeAction}
        title={operationType === 'transfer' ? t.transferTitle : t.mergeTitle}
        size="sm"
      >
        <p className="text-[13px] text-brand-text-muted mb-4">
          {operationType === 'transfer' ? t.transferHint : t.mergeHint}
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-[13px] text-brand-text-muted block mb-1.5">{t.sourceTable}</label>
            <input
              value={sourceTableLabel}
              disabled
              className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 text-sm text-brand-text"
            />
          </div>
          <div>
            <label className="text-[13px] text-brand-text-muted block mb-1.5">{t.targetTable}</label>
            <select
              value={targetTable ?? ''}
              onChange={(e) => setTargetTable(e.target.value || null)}
              disabled={actionTargetsLoading}
              className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/40 disabled:opacity-60"
            >
              <option value="">
                {actionTargetsLoading ? t.tableDetailLoading : '--'}
              </option>
              {targetCandidates.map((table) => (
                <option key={table.id} value={table.id}>
                  {t.table} {table.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={closeAction}
            className={`${waiterUi.btnSecondary} ${waiterUi.btnGhost} text-sm`}
          >
            {lang === 'zh' ? '取消' : lang === 'en' ? 'Cancel' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={handleActionSubmit}
            disabled={!sourceTable || !targetTable || operating}
            className={`${waiterUi.btnBuffet} text-sm disabled:opacity-50`}
          >
            {operationType === 'transfer'
              ? (operating ? t.operatingTransfer : t.confirmTransfer)
              : (operating ? t.operatingMerge : t.confirmMerge)}
          </button>
        </div>
      </Modal>
      {isDemo ? (
        <ConfirmModal
          open={demoCloseConfirmTableId != null}
          onClose={() => setDemoCloseConfirmTableId(null)}
          title={demoCloseConfirmCopy.title}
          message={demoCloseConfirmCopy.message}
          confirmLabel={t.closeTableConfirmButton}
          cancelLabel={t.closeTableCancel}
          variant="danger"
          confirming={closingDemoTable === demoCloseConfirmTableId}
          onConfirm={async () => {
            if (!demoCloseConfirmTableId) return;
            const closeTableId = demoCloseConfirmTableId;
            setDemoCloseConfirmTableId(null);
            await closeDemoTable(closeTableId);
          }}
        />
      ) : null}
      <VoidItemReasonDialog
        open={pendingVoidDecrement != null}
        onClose={() => {
          setPendingVoidDecrement(null);
          setVoidReasonError(null);
        }}
        lang={lang}
        item={
          pendingVoidDecrement
            ? pendingVoidDecrement.order.items[pendingVoidDecrement.itemIdx] ?? null
            : null
        }
        confirming={voidingDecrement}
        externalError={voidReasonError}
        onConfirm={performVoidDecrement}
      />
    </div>
  );
}

export function WaiterTableDetail(props: Props) {
  const { restaurant, isDemo, embeddedInDashboard } = props;
  if (embeddedInDashboard) {
    return (
      <WaiterTableDetailInner
        {...props}
        handleSignOut={() => {}}
        exitLabel=""
      />
    );
  }
  return (
    <WaiterAuthenticatedShell restaurant={restaurant} isDemo={isDemo}>
      {({ handleSignOut, exitLabel }) => (
        <WaiterTableDetailInner {...props} handleSignOut={handleSignOut} exitLabel={exitLabel} />
      )}
    </WaiterAuthenticatedShell>
  );
}
