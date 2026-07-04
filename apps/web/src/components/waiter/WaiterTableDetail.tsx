'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Order } from '@/types';
import {
  aggregateBuffetForOrders,
  buildBuffetBaseLine,
  isBuffetGuestCountsUnchanged,
  resolveBuffetFormAlignState,
  resolveBuffetOpenPricePreview,
} from '@/lib/buffet-order';
import {
  applyBuffetOpenOptimisticToOrders,
  OPTIMISTIC_OPEN_SESSION_ID,
} from '@/lib/buffet-open-table';
import { ordersForWaiterTableView } from '@/lib/waiter-table-orders';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { WaiterTableDetailHeader } from '@/components/waiter/WaiterTableDetailHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { VoidItemReasonDialog } from '@/lib/order-item-void/VoidItemReasonDialog';
import { showToast } from '@/components/ui/Toast';
import { coerceCartQty } from '@/lib/cart-totals';
import { applyOrderItemDecrement } from '@/lib/order-item-void/decrement-order-item';
import { computeOrderTotalsFromItems } from '@/lib/order-item-void/persist-order-items-update';
import { voidItemReasonErrorMessage } from '@/lib/order-item-void/void-item-reason-ui';
import { WaiterAuthenticatedShell } from '@/components/waiter/WaiterAuthenticatedShell';
import { useWaiterTableDetail } from '@/components/waiter/useWaiterTableDetail';
import { useStaffAssistedMenuEntryPrefetch } from '@/components/waiter/useStaffAssistedMenuEntryPrefetch';
import { useWaiterTableBuffetForm } from '@/components/waiter/useWaiterTableBuffetForm';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { buildWaiterTableCard } from '@/components/waiter/waiter-table-card';
import { isWaiterTableCardOccupied } from '@/lib/waiter-table-occupancy';
import { waiterUi } from '@/components/waiter/waiter-ui';
import { Button } from '@/components/ui/Button';
import { postWaiterDecrementOrderItemClient } from '@/lib/waiter-decrement-order-item-client';
import { applyOrderUpdateToWaiterDetail } from '@/lib/waiter-table-detail-apply-order';
import {
  fetchWaiterTableActionTargetsClient,
  fetchWaiterTablePageModelClient,
  postWaiterBuffetOpenClient,
} from '@/lib/staff-board-client';
import { commitAuthoritativeWaiterTablePageModel } from '@/lib/waiter-staff-mutation-sync';
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { tableIdsEqual, type RestaurantTableRow } from '@/lib/restaurant-tables';
import {
  dashboardCheckoutTableHref,
  waiterBoardHref,
  waiterTableHref,
  waiterMenuHref,
  waiterBillHref,
} from '@/lib/staff-routes';
import type { WaiterTableDetailData } from '@/lib/staff-board';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import {
  WaiterCheckoutPendingBanner,
  WaiterTableBuffetPanel,
  WaiterTableOccupiedToolbar,
  WaiterTableOrderedItemsPanel,
} from '@/components/waiter/WaiterTableDetailLayout';
import { resolveWaiterTableDetailActions } from '@/lib/waiter-table-detail-actions';

interface Props {
  restaurant: { id: string; name: string; slug: string };
  /** Demo only — all configured tables for transfer/merge UI. */
  tables?: RestaurantTableRow[];
  /** Demo only — full demo order set. */
  initialOrders?: Order[];
  /** Server-rendered page model; avoids duplicate fetch on navigation. */
  initialModel?: WaiterTablePageModel | null;
  tableId: string;
  /** Demo only — table label before detail state resolves. */
  displayName?: string;
  isDemo?: boolean;
  embeddedInDashboard?: boolean;
}

function WaiterTableDetailInner({
  restaurant,
  tables: demoTablesProp = [],
  initialOrders = [],
  initialModel = null,
  tableId,
  displayName = '',
  isDemo = false,
  embeddedInDashboard = false,
  handleSignOut,
  exitLabel,
  confirmBeforeSignOut,
}: Props & { handleSignOut: () => void; exitLabel: string; confirmBeforeSignOut: boolean }) {
  const router = useRouter();
  const { lang } = useLanguage();
  const locale = UI_LOCALE_BY_LANG[lang];
  const t = WAITER_TEXT[lang];
  const {
    table: selectedTable,
    orders,
    refresh,
    applyModel,
    model,
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
    !isDemo,
    isDemo,
    demoTablesProp,
    initialOrders,
    initialModel,
  );

  const [itemCodeByMenuId, setItemCodeByMenuId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isDemo) return;
    const menuItemIds = distinctMenuItemIdsFromOrders(orders);
    if (menuItemIds.length === 0) {
      setItemCodeByMenuId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data: menuRows } = await supabase
        .from('menu_items')
        .select('id, item_code')
        .eq('restaurant_id', restaurant.id)
        .in('id', menuItemIds);
      if (!cancelled) {
        setItemCodeByMenuId(menuItemCodeLookupFromRows(menuRows ?? []));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDemo, orders, restaurant.id, supabase]);

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
  const activeBuffets = useMemo(
    () => (model?.buffets ?? []).filter((b) => b.is_active),
    [model?.buffets],
  );
  const contextTableId = selectedTable?.id ?? tableId;
  const buffetFormAlign = useMemo(
    () =>
      resolveBuffetFormAlignState({
        detailLoaded: isDemo || detailLoaded,
        orders,
        defaultBuffetId: activeBuffets[0]?.id ?? null,
      }),
    [activeBuffets, detailLoaded, isDemo, orders],
  );
  const {
    buffetId,
    setBuffetId,
    selectedBuffet,
    buffetAdults,
    buffetChildren,
    setBuffetGuestCount,
    buffetResolved,
    buffetPriceLoading,
  } = useWaiterTableBuffetForm({
    tableId: contextTableId,
    sessionId: sessionMeta?.sessionId ?? null,
    alignState: buffetFormAlign,
    restaurantId: restaurant.id,
    activeBuffets,
    buffetPricesByBuffetId: model?.buffetPricesByBuffetId ?? {},
    isDemo,
    supabase,
  });
  const [buffetSubmitting, setBuffetSubmitting] = useState(false);

  const buffetPriceDisplay = useMemo(
    () => resolveBuffetOpenPricePreview(buffetResolved, buffetAdults, buffetChildren),
    [buffetResolved, buffetAdults, buffetChildren],
  );

  const applyDetail = useCallback(
    (detail: WaiterTableDetailData) => {
      applyModel({
        detail,
        buffets: model?.buffets ?? [],
        buffetPricesByBuffetId: model?.buffetPricesByBuffetId ?? {},
      });
    },
    [applyModel, model?.buffetPricesByBuffetId, model?.buffets],
  );

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

  useEffect(() => {
    if (isDemo || !detailLoaded) return;
    if (!isCheckoutPending && sessionMeta?.status !== 'billing') return;
    if (embeddedInDashboard) {
      router.replace(dashboardCheckoutTableHref(tableId));
      return;
    }
    router.replace(waiterBoardHref(restaurant.slug, routeOptions));
  }, [
    detailLoaded,
    embeddedInDashboard,
    isCheckoutPending,
    isDemo,
    restaurant.slug,
    routeOptions,
    router,
    sessionMeta?.status,
    tableId,
  ]);

  const pageShellClass = embeddedInDashboard ? '' : 'min-h-screen bg-brand-bg p-4';
  const boardHref = waiterBoardHref(restaurant.slug, routeOptions);
  const menuHref = waiterMenuHref(restaurant.slug, tableId, routeOptions);
  const billHref = waiterBillHref(restaurant.slug, tableId, routeOptions);

  useStaffAssistedMenuEntryPrefetch(
    menuHref,
    isWaiterTableCardOccupied(selectedCard) && !isCheckoutPending && !isDemo,
  );

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
      const targetModel = await fetchWaiterTablePageModelClient(restaurant.slug, targetTableId);
      applyModel(targetModel);
      const toastText =
        operation === 'transfer'
          ? t.transferDone.replace('{table}', targetLabel)
          : t.mergeDone.replace('{table}', targetLabel);
      closeAction();
      showToast(toastText, 'success');
      goToTableDetail(targetTableId);
    },
    [applyModel, goToTableDetail, restaurant.slug, t.mergeDone, t.transferDone],
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

  const detailHeading = (tableLabel: string) => `${t.detailsTitle} · ${t.table} ${tableLabel}`;

  if (!isDemo && !detailLoaded) {
    return (
      <div className={pageShellClass}>
        <WaiterTableDetailHeader
          boardHref={boardHref}
          backLabel={t.backToBoard}
          heading={detailHeading('…')}
          embeddedInDashboard={embeddedInDashboard}
          exitLabel={exitLabel}
          onSignOut={handleSignOut}
          confirmSignOut={confirmBeforeSignOut}
        />
        <div
          className={`${waiterUi.cardSurface} p-6 animate-pulse`}
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
      <div className={pageShellClass}>
        <WaiterTableDetailHeader
          boardHref={boardHref}
          backLabel={t.backToBoard}
          heading={detailHeading(displayName || '…')}
          embeddedInDashboard={embeddedInDashboard}
          exitLabel={exitLabel}
          onSignOut={handleSignOut}
          confirmSignOut={confirmBeforeSignOut}
        />
        <div className={`${waiterUi.cardSurface} p-4 text-sm text-brand-text-muted`}>
          {t.noOrdersOnTable}
        </div>
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

  const tableOccupied = isWaiterTableCardOccupied(selectedCard);
  const detailActions = resolveWaiterTableDetailActions({
    embeddedInDashboard,
    isDemo,
    isCheckoutPending,
    isOccupied: tableOccupied,
    hasActiveBuffets: activeBuffets.length > 0,
  });

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
      const nextModel = await postWaiterBuffetOpenClient(restaurant.slug, {
        table_id: tableId,
        buffet_id: buffetId,
        adult_count: buffetAdults,
        child_count: buffetChildren,
      });
      const normalized = applyModel(nextModel);
      commitAuthoritativeWaiterTablePageModel(normalized);
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
        const { outcome, order: updatedOrder } = await postWaiterDecrementOrderItemClient(
          restaurant.slug,
          orderId,
          {
            item_index: itemIdx,
            updated_at: order.updated_at,
            ...(voidReason ? { void_reason: voidReason, void_reason_detail: voidReasonDetail } : {}),
          },
        );
        applyDetail(applyOrderUpdateToWaiterDetail(currentTableDetail(), updatedOrder));
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

      <WaiterTableDetailHeader
        boardHref={boardHref}
        backLabel={t.backToBoard}
        heading={detailHeading(selectedCard.displayName)}
        updatedAtLabel={tableUpdatedLabel}
        embeddedInDashboard={embeddedInDashboard}
        exitLabel={exitLabel}
        onSignOut={handleSignOut}
        confirmSignOut={confirmBeforeSignOut}
      />

      <div className="space-y-4">
        {isCheckoutPending ? <WaiterCheckoutPendingBanner message={t.checkoutPendingBanner} /> : null}

        {detailActions.showBuffetPanel ? (
          <WaiterTableBuffetPanel
            t={t}
            activeBuffets={activeBuffets}
            selectedBuffet={selectedBuffet}
            buffetId={buffetId}
            onBuffetIdChange={setBuffetId}
            buffetAdults={buffetAdults}
            buffetChildren={buffetChildren}
            onSetGuestCount={setBuffetGuestCount}
            buffetPriceLoading={buffetPriceLoading}
            buffetPriceDisplay={buffetPriceDisplay}
            buffetActionLabel={buffetActionLabel}
            buffetSubmitting={buffetSubmitting}
            onSave={() => void applyBuffetToTable()}
          />
        ) : null}

        {detailActions.showOccupiedToolbar ? (
          <WaiterTableOccupiedToolbar
            t={t}
            tableId={selectedCard.tableId}
            menuHref={menuHref}
            billHref={billHref}
            isCheckoutPending={isCheckoutPending}
            onCheckoutLocked={notifyCheckoutLocked}
            onTransfer={() => openAction('transfer', selectedCard.tableId)}
            onMerge={() => openAction('merge', selectedCard.tableId)}
            showGoToBill={detailActions.showGoToBill}
            showCloseTable={detailActions.showCloseTable}
            isDemo={isDemo}
            closingDemoTable={closingDemoTable === selectedCard.tableId}
            onDemoCloseClick={() => {
              if (isCheckoutPending) {
                void closeDemoTable(selectedCard.tableId);
                return;
              }
              setDemoCloseConfirmTableId(selectedCard.tableId);
            }}
            onTableClosed={() => {
              void refresh();
            }}
          />
        ) : null}

        <WaiterTableOrderedItemsPanel
          title={t.orderedItems}
          lines={selectedCard.orderLines}
          isCheckoutPending={isCheckoutPending}
          decrementingKey={decrementingKey}
          orderLineKey={orderLineKey}
          onDecrement={(orderId, itemIdx) => void handleDecrementOrderLine(orderId, itemIdx)}
        />
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
          <Button type="button" variant="ghost" size="sm" onClick={closeAction}>
            {lang === 'zh' ? '取消' : lang === 'en' ? 'Cancel' : 'Cancelar'}
          </Button>
          <Button
            type="button"
            variant="gold"
            size="sm"
            onClick={handleActionSubmit}
            disabled={!sourceTable || !targetTable || operating}
          >
            {operationType === 'transfer'
              ? (operating ? t.operatingTransfer : t.confirmTransfer)
              : (operating ? t.operatingMerge : t.confirmMerge)}
          </Button>
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
        confirmBeforeSignOut={false}
      />
    );
  }
  return (
    <WaiterAuthenticatedShell restaurant={restaurant} isDemo={isDemo}>
      {({ handleSignOut, exitLabel, confirmBeforeSignOut }) => (
        <WaiterTableDetailInner
          {...props}
          handleSignOut={handleSignOut}
          exitLabel={exitLabel}
          confirmBeforeSignOut={confirmBeforeSignOut}
        />
      )}
    </WaiterAuthenticatedShell>
  );
}
