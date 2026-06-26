'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Buffet, Order } from '@/types';
import {
  aggregateBuffetForOrders,
  buildBuffetBaseLine,
  formatBuffetSummaryLine,
  isBuffetHeadcountUnchanged,
  parseResolvedBuffetPriceRpcRow,
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
import { IntegerInput } from '@/components/ui/IntegerInput';
import { showToast } from '@/components/ui/Toast';
import { deriveOrderStatusFromItems } from '@/lib/order-status';
import { WaiterAuthenticatedShell } from '@/components/waiter/WaiterAuthenticatedShell';
import { useWaiterTableDetail } from '@/components/waiter/useWaiterTableDetail';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { buildWaiterTableCard } from '@/components/waiter/waiter-table-card';
import { waiterUi } from '@/components/waiter/waiter-ui';
import { useBuffetPricesRealtimeRefresh } from '@/lib/use-buffet-prices-realtime-refresh';
import { fetchWaiterTableActionTargetsClient, postWaiterBuffetOpenClient } from '@/lib/staff-board-client';
import { tableIdsEqual, type RestaurantTableRow } from '@/lib/restaurant-tables';
import { waiterBoardHref, waiterTableHref } from '@/lib/staff-routes';
import { requestDashboardCheckoutRequest } from '@/lib/request-dashboard-checkout-request';
import type { WaiterTableDetailData } from '@/lib/staff-board';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import { interpretCloseTableSessionResponse } from '@/lib/close-table-session-ui';

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
  const [closingTable, setClosingTable] = useState<string | null>(null);
  const [checkoutCloseConfirmTableId, setCheckoutCloseConfirmTableId] = useState<string | null>(null);
  const [callingBill, setCallingBill] = useState(false);
  const activeBuffets = useMemo(() => initialBuffets.filter((b) => b.is_active), [initialBuffets]);
  const [buffetId, setBuffetId] = useState<string>(() => activeBuffets[0]?.id || '');
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

  const buffetPriceDisplay = useMemo(() => {
    const r = buffetResolved;
    if (!r || r.adult_price == null || r.child_price == null) return { ok: false as const };
    const ap = Number(r.adult_price);
    const cp = Number(r.child_price);
    if (!Number.isFinite(ap) || !Number.isFinite(cp)) return { ok: false as const };
    const adults = Math.max(0, Math.floor(buffetAdults));
    const children = Math.max(0, Math.floor(buffetChildren));
    return { ok: true as const, ap, cp, sub: adults * ap + children * cp };
  }, [buffetResolved, buffetAdults, buffetChildren]);

  useEffect(() => {
    if (activeBuffets.length === 0) return;
    if (!buffetId || !activeBuffets.some((b) => b.id === buffetId)) {
      setBuffetId(activeBuffets[0].id);
    }
  }, [activeBuffets, buffetId]);

  const selectedDisplayName = selectedTable?.display_name || displayName;

  const tableOrders = useMemo(() => {
    if (isDemo) return orders;
    return ordersForWaiterTableView(tableId, orders, activeSessionByTableId);
  }, [activeSessionByTableId, isDemo, orders, tableId]);

  const selectedCard = useMemo(
    () => buildWaiterTableCard(tableId, selectedDisplayName, tableOrders, itemCodeByMenuId),
    [tableOrders, tableId, selectedDisplayName, itemCodeByMenuId],
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
    () => aggregateBuffetForOrders(tableOrders),
    [tableOrders],
  );

  useEffect(() => {
    if (!tableBuffetAggregate) return;
    setBuffetId(tableBuffetAggregate.buffetId);
    setBuffetAdults(tableBuffetAggregate.adults);
    setBuffetChildren(tableBuffetAggregate.children);
  }, [tableBuffetAggregate]);

  const demoActiveTableIds = useMemo(() => {
    if (!isDemo) return [] as string[];
    return demoTables
      .filter((table) => {
        const view = ordersForWaiterTableView(table.id, initialOrders, activeSessionByTableId);
        const c = buildWaiterTableCard(table.id, table.display_name, view, itemCodeByMenuId);
        return c.orderLines.length > 0 || c.hasBuffet;
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
  const boardHref = waiterBoardHref(restaurant.slug, routeOptions);
  const waiterReturnPath = waiterTableHref(restaurant.slug, tableId, routeOptions);
  const menuHref = isDemo
    ? `/demo/menu?table_id=${encodeURIComponent(tableId)}&from=waiter&return=${encodeURIComponent(waiterReturnPath)}`
    : `/${restaurant.slug}/menu?table_id=${encodeURIComponent(tableId)}&from=waiter&return=${encodeURIComponent(waiterReturnPath)}`;

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

  const closeConfirmCopy = useMemo(() => {
    const pendingTableId = checkoutCloseConfirmTableId;
    if (!pendingTableId) {
      return { title: t.closeTableConfirmTitle, message: t.closeTableConfirmMessage };
    }
    const hasCheckoutRequest = tableIdsEqual(pendingTableId, tableId) && isCheckoutPending;
    if (hasCheckoutRequest) {
      return {
        title: t.closeTableCheckoutConfirmTitle,
        message: t.closeTableCheckoutConfirmMessage,
      };
    }
    return { title: t.closeTableConfirmTitle, message: t.closeTableConfirmMessage };
  }, [checkoutCloseConfirmTableId, isCheckoutPending, tableId, t]);

  if (!isDemo && !detailLoaded) {
    return (
      <div className={embeddedInDashboard ? '' : 'min-h-screen bg-brand-bg p-4'}>
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
        <div
          className="rounded-2xl border border-brand-border/50 bg-brand-card/70 p-6 animate-pulse"
          aria-busy="true"
          aria-label={t.tableDetailLoading}
        >
          <div className="h-5 w-48 rounded bg-brand-border/60 mb-4" />
          <div className="h-24 rounded bg-brand-border/40" />
        </div>
        <p className="text-sm text-brand-text-muted mt-3">{t.tableDetailLoading}</p>
      </div>
    );
  }

  if (!isDemo && detailLoaded && !selectedTable) {
    return (
      <div className={embeddedInDashboard ? '' : 'min-h-screen bg-brand-bg p-4'}>
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

  const closeTableFromWaiter = async (closeTableId: string, confirmClose = false) => {
    setClosingTable(closeTableId);
    try {
      if (!isDemo) {
        const closeUrl = embeddedInDashboard
          ? '/api/dashboard/close-table-session'
          : `/api/restaurants/${encodeURIComponent(restaurant.slug)}/staff/waiter/sessions/close`;
        const res = await fetch(closeUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_id: closeTableId,
            confirm_close: confirmClose,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
        const next = interpretCloseTableSessionResponse(res.status, data);
        if (next.action === 'no_session') {
          showToast(t.closeTableNoSession, 'error');
          return;
        }
        if (next.action === 'confirm_close') {
          setCheckoutCloseConfirmTableId(closeTableId);
          return;
        }
        if (next.action === 'error') {
          showToast(t.actionFailed, 'error');
          return;
        }
        await refresh();
        showToast(t.actionSuccess, 'success');
        return;
      }

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
      setClosingTable(null);
    }
  };

  const requestCloseTable = (closeTableId: string) => {
    setCheckoutCloseConfirmTableId(closeTableId);
  };

  const handleCallBill = async () => {
    if (isDemo || !embeddedInDashboard || isCheckoutPending) return;
    if (selectedCard.orderLines.length === 0 && !selectedCard.hasBuffet) {
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
    embeddedInDashboard && !isCheckoutPending && (selectedCard.orderLines.length > 0 || selectedCard.hasBuffet);

  const applyBuffetToTable = async () => {
    if (!buffetId) return;
    if (isCheckoutPending) {
      notifyCheckoutLocked();
      return;
    }

    const buffet = activeBuffets.find((b) => b.id === buffetId);
    if (!buffet) return;

    if (isBuffetHeadcountUnchanged(tableOrders, buffetId, buffetAdults, buffetChildren)) {
      showToast(t.buffetHeadcountUnchanged, 'info');
      return;
    }

    if (!buffetResolved) {
      showToast(t.buffetNoRule, 'error');
      return;
    }

    const line = buildBuffetBaseLine({
      buffet,
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
      sessionMeta: sessionMeta ?? {
        sessionId: optimisticSessionId,
        openedAt: new Date().toISOString(),
        status: 'open',
      },
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

  const voidItemFromWaiter = async (orderId: string, itemIdx: number) => {
    if (isCheckoutPending) {
      notifyCheckoutLocked();
      return;
    }
    try {
      const order = orders.find((row) => row.id === orderId);
      if (!order) return;
      const nextItems = order.items.map((item, idx) => {
        if (idx !== itemIdx) return item;
        return {
          ...item,
          item_status: 'voided' as const,
          voided_at: new Date().toISOString(),
        };
      });

      if (!isDemo) {
        const res = await fetch(
          `/api/restaurants/${encodeURIComponent(restaurant.slug)}/staff/waiter/orders/${orderId}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: nextItems, updated_at: order.updated_at }),
          },
        );
        if (res.status === 409) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (data.error === 'session_billing') {
            notifyCheckoutLocked();
            return;
          }
          showToast(t.refreshHint, 'error');
          await refresh();
          return;
        }
        if (!res.ok) {
          showToast(t.actionFailed, 'error');
          return;
        }
        await refresh();
        showToast(t.voidedLabel, 'success');
        return;
      }

      const nextOrderStatus = deriveOrderStatusFromItems(nextItems);
      const { error } = await supabase
        .from('orders')
        .update({
          items: nextItems,
          status: nextOrderStatus,
        })
        .eq('id', orderId)
        .eq('updated_at', order.updated_at);

      if (error) {
        showToast(t.refreshHint, 'error');
        return;
      }

      await refresh();
      showToast(t.voidedLabel, 'success');
    } catch {
      showToast(t.actionFailed, 'error');
    }
  };

  return (
    <div className={embeddedInDashboard ? '' : 'min-h-screen bg-brand-bg p-4'}>
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
          <h1 className="font-heading text-2xl text-brand-gold mt-2">
            {t.detailsTitle} · {t.table} {selectedCard.displayName}
          </h1>
        )}
      </div>

      <div className="rounded-2xl p-4 border border-brand-border/50 bg-brand-card shadow-sm shadow-black/5">
        <div className="flex items-center justify-between mb-3">
          {!embeddedInDashboard ? (
            <h2 className="font-heading text-2xl text-brand-text">{t.detailsTitle} - {t.table} {selectedCard.displayName}</h2>
          ) : (
            <h2 className="font-heading text-lg text-brand-text">{t.boardTitle}</h2>
          )}
          <span className="text-[13px] text-brand-text-muted">
            {selectedCard.updatedAt
              ? new Date(selectedCard.updatedAt).toLocaleString(locale, {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
              : '-'}
          </span>
        </div>

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
          <div className="mb-4 rounded-xl border border-brand-gold/30 bg-brand-gold/8 p-3 space-y-2">
            <p className="text-[12px] font-medium text-brand-gold">{t.buffetBlock}</p>
            {tableBuffetAggregate && (
              <p className="text-[13px] text-brand-text">
                {formatBuffetSummaryLine(tableBuffetAggregate)}
              </p>
            )}
            <div className="rounded-lg border border-brand-border/50 bg-brand-bg/60 px-2.5 py-2 space-y-1">
              <p className="text-[11px] font-medium text-brand-text-muted">{t.buffetPreview}</p>
              {buffetPriceLoading ? (
                <p className="text-[12px] text-brand-text-muted">{t.buffetPriceLoading}</p>
              ) : buffetPriceDisplay.ok ? (
                <>
                  <p className="text-[13px] text-brand-text">
                    {t.buffetPriceAdult.replace('{price}', buffetPriceDisplay.ap.toFixed(2))}
                  </p>
                  <p className="text-[13px] text-brand-text">
                    {t.buffetPriceChild.replace('{price}', buffetPriceDisplay.cp.toFixed(2))}
                  </p>
                  <p className="text-[13px] text-brand-gold font-medium pt-1 border-t border-brand-border/40">
                    {t.buffetPriceSubtotal.replace('{total}', buffetPriceDisplay.sub.toFixed(2))}
                  </p>
                  <p className="text-[10px] text-brand-text-muted leading-snug pt-1">{t.buffetPriceNearestNote}</p>
                </>
              ) : (
                <p className="text-[12px] mesa-text-warning">{t.buffetNoRule}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="text-[11px] text-brand-text-muted">
                {t.buffetPick}
                <select
                  value={buffetId}
                  onChange={(e) => setBuffetId(e.target.value)}
                  className="mt-0.5 block rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-sm text-brand-text"
                >
                  {activeBuffets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-brand-text-muted">
                {t.buffetAdults}
                <IntegerInput
                  min={0}
                  clearZeroOnFocus
                  className="mt-0.5 block w-16 rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-sm text-brand-text"
                  value={buffetAdults}
                  onChange={setBuffetAdults}
                />
              </label>
              <label className="text-[11px] text-brand-text-muted">
                {t.buffetChildren}
                <IntegerInput
                  min={0}
                  clearZeroOnFocus
                  className="mt-0.5 block w-16 rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-sm text-brand-text"
                  value={buffetChildren}
                  onChange={setBuffetChildren}
                />
              </label>
              <button
                type="button"
                onClick={() => void applyBuffetToTable()}
                disabled={buffetSubmitting}
                className={waiterUi.btnBuffet}
              >
                {buffetSubmitting ? '…' : t.buffetApply}
              </button>
            </div>
          </div>
        )}

        {selectedCard.orderLines.length === 0 && !selectedCard.hasBuffet ? (
          <p className="text-brand-text-muted">{t.buffetNeedOpen}</p>
        ) : (
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
                <button
                  type="button"
                  onClick={() => requestCloseTable(selectedCard.tableId)}
                  disabled={closingTable === selectedCard.tableId}
                  className={`${waiterUi.btnSecondary} ${waiterUi.btnDanger} disabled:opacity-50`}
                >
                  {closingTable === selectedCard.tableId ? t.closeTableOperating : t.closeTable}
                </button>
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
                    {line.canVoid && (
                      <button
                        type="button"
                        onClick={() => void voidItemFromWaiter(line.orderId, line.itemIdx)}
                        className={`shrink-0 ${waiterUi.btnSecondary} ${waiterUi.btnGhost} ${checkoutLockedClass}`}
                      >
                        {t.voidItem}
                      </button>
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
      <ConfirmModal
        open={checkoutCloseConfirmTableId != null}
        onClose={() => setCheckoutCloseConfirmTableId(null)}
        title={closeConfirmCopy.title}
        message={closeConfirmCopy.message}
        confirmLabel={t.closeTableConfirmButton}
        cancelLabel={t.closeTableCancel}
        variant="danger"
        confirming={closingTable === checkoutCloseConfirmTableId}
        onConfirm={async () => {
          if (!checkoutCloseConfirmTableId) return;
          const tableId = checkoutCloseConfirmTableId;
          setCheckoutCloseConfirmTableId(null);
          await closeTableFromWaiter(tableId, true);
        }}
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
