'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Order } from '@/types';
import { resolveBuffetFormAlignState } from '@/lib/buffet-order';
import { isTableSessionOpen } from '@/lib/guest-table-ordering';
import {
  buffetOpenSubmitBlockReason,
  postWaiterBuffetOpenAndCommit,
} from '@/lib/waiter-buffet-open-submit';
import { isBuffetPackagesEditorReady } from '@/components/waiter/WaiterBuffetPackagesEditor';
import { ordersForWaiterTableView } from '@/lib/waiter-table-orders';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { WaiterTableDetailHeader } from '@/components/waiter/WaiterTableDetailHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { showToast } from '@/components/ui/Toast';
import { applyOrderItemDecrement } from '@/lib/order-item-void/decrement-order-item';
import { computeOrderTotalsFromItems } from '@/lib/order-item-void/persist-order-items-update';
import { useWaiterTableDetail } from '@/components/waiter/useWaiterTableDetail';
import { useStaffAssistedMenuEntryPrefetch } from '@/components/waiter/useStaffAssistedMenuEntryPrefetch';
import { useWaiterTableBuffetForm } from '@/components/waiter/useWaiterTableBuffetForm';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { formatWaiterTableDetailHeading, formatWaiterOrderedItemsSessionTotal } from '@/lib/waiter-table-detail-display';
import { buildWaiterTableCard } from '@/components/waiter/waiter-table-card';
import { resolveMenuDecrementOperator } from '@/lib/order-item-decrement/decrement-policy';
import type { StaffRole } from '@/lib/staff-account';
import { isWaiterTableCardOccupied } from '@/lib/waiter-table-occupancy';
import { waiterUi } from '@/components/waiter/waiter-ui';
import { Button } from '@/components/ui/Button';
import { postWaiterDecrementOrderItemClient } from '@/lib/waiter-decrement-order-item-client';
import { applyOrderUpdateToWaiterDetail } from '@/lib/waiter-table-detail-apply-order';
import {
  fetchWaiterTableActionTargetsClient,
  fetchWaiterTablePageModelClient,
  postWaiterTableActionClient,
} from '@/lib/staff-board-client';
import {
  clearPublishedWaiterTablePageModel,
  commitWaiterSessionRelocation,
} from '@/lib/waiter-staff-mutation-sync';
import { filterWaiterTableActionTargets } from '@/lib/waiter-table-occupancy';
import { useWaiterBoardOptional } from '@/components/dashboard/WaiterBoardProvider';
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { tableIdsEqual, type RestaurantTableRow } from '@/lib/restaurant-tables';
import {
  dashboardCheckoutTableHref,
  waiterBoardHref,
  waiterTableHref,
  waiterMenuHref,
} from '@/lib/staff-routes';
import type { WaiterTableDetailData } from '@/lib/staff-board';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import { normalizeWaiterTablePageModel } from '@/lib/waiter-table-detail-normalize';
import {
  WaiterCheckoutPendingBanner,
  WaiterTableBuffetPanel,
  WaiterTableOccupiedToolbar,
  WaiterTableOrderedItemsPanel,
} from '@/components/waiter/WaiterTableDetailLayout';
import { resolveWaiterTableDetailActions } from '@/lib/waiter-table-detail-actions';
import { WaiterTableBackToBoardFooter } from '@/components/waiter/waiter-table-detail-ui';

interface Props {
  restaurant: { id: string; name: string; slug: string };
  /** SSR successfully loaded detail — skip mount entry reconcile. */
  hasAuthoritativeSeed?: boolean;
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
  /** Dashboard floor staff role — required when embeddedInDashboard. */
  floorStaffRole?: Extract<StaffRole, 'frontdesk' | 'cashier'>;
}

function WaiterTableDetailInner({
  restaurant,
  hasAuthoritativeSeed = false,
  tables: demoTablesProp = [],
  initialOrders = [],
  initialModel = null,
  tableId,
  displayName = '',
  isDemo = false,
  embeddedInDashboard = false,
  floorStaffRole,
}: Props) {
  const router = useRouter();
  const waiterBoard = useWaiterBoardOptional();
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
    hasAuthoritativeSeed,
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
  const activeBuffets = useMemo(
    () => (model?.buffets ?? []).filter((b) => b.is_active),
    [model?.buffets],
  );
  const contextTableId = selectedTable?.id ?? tableId;
  const activeBuffetIds = useMemo(() => activeBuffets.map((b) => b.id), [activeBuffets]);
  const hasOpenSession = isTableSessionOpen(sessionMeta);
  const buffetFormAlign = useMemo(
    () =>
      resolveBuffetFormAlignState({
        detailLoaded: isDemo || detailLoaded,
        hasOpenSession,
        orders,
        activeBuffetIds,
        defaultBuffetId: activeBuffets[0]?.id ?? null,
      }),
    [activeBuffetIds, activeBuffets, detailLoaded, hasOpenSession, isDemo, orders],
  );
  const {
    guestSnapshot,
    setBuffetGuestCount,
    resolvedByBuffetId,
    priceLoading: buffetPriceLoading,
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

  const menuDecrementOperator = useMemo(
    () =>
      resolveMenuDecrementOperator({
        role: floorStaffRole ?? 'waiter',
      }),
    [floorStaffRole],
  );

  const selectedCard = useMemo(
    () =>
      buildWaiterTableCard(
        tableId,
        selectedDisplayName,
        orders,
        itemCodeByMenuId,
        menuDecrementOperator,
      ),
    [orders, tableId, selectedDisplayName, itemCodeByMenuId, menuDecrementOperator],
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

  const buffetActionLabel = hasOpenSession ? t.buffetSaveGuestCounts : t.buffetConfirm;

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

  const pageShellClass = isDemo ? 'min-h-screen bg-brand-bg p-4' : '';
  const boardHref = waiterBoardHref(restaurant.slug, routeOptions);
  const menuHref = waiterMenuHref(restaurant.slug, tableId, routeOptions);

  useStaffAssistedMenuEntryPrefetch(
    menuHref,
    hasOpenSession && !isCheckoutPending && !isDemo && detailLoaded,
  );

  const resolveActionTargetsFromBoard = useCallback(
    (type: 'transfer' | 'merge', sourceId: string): RestaurantTableRow[] | null => {
      if (!waiterBoard) return null;
      return filterWaiterTableActionTargets(
        waiterBoard.tables,
        sourceId,
        type,
        waiterBoard.sessionMetaByTableId,
        waiterBoard.checkoutRequestedTableIds,
      );
    },
    [waiterBoard],
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

    const localTargets = resolveActionTargetsFromBoard(type, sourceId);
    if (localTargets) {
      setActionTargets(localTargets);
      return;
    }

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
    async (
      sourceTableId: string,
      targetTableId: string,
      operation: 'transfer' | 'merge',
      targetLabel: string,
      targetModel: WaiterTablePageModel,
    ) => {
      const normalized = normalizeWaiterTablePageModel(targetModel);
      commitWaiterSessionRelocation({
        sourceTableId,
        targetModel: normalized,
      });
      if (embeddedInDashboard && waiterBoard) {
        waiterBoard.reconcileBoardAfterSessionRelocation({
          sourceTableId,
          targetModel: normalized,
        });
      }
      const toastText =
        operation === 'transfer'
          ? t.transferDone.replace('{table}', targetLabel)
          : t.mergeDone.replace('{table}', targetLabel);
      closeAction();
      showToast(toastText, 'success');
      goToTableDetail(targetTableId);
    },
    [
      embeddedInDashboard,
      goToTableDetail,
      t.mergeDone,
      t.transferDone,
      waiterBoard,
    ],
  );

  const finishTableClose = useCallback(
    (closedTableId: string) => {
      clearPublishedWaiterTablePageModel(closedTableId);
      void waiterBoard?.refreshBoardAfterStaffMutation([closedTableId]);
      router.replace(boardHref);
    },
    [boardHref, router, waiterBoard],
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
        const targetLabel =
          targetCandidates.find((row) => tableIdsEqual(row.id, toTable))?.display_name ?? toTable;
        try {
          const { model } = await postWaiterTableActionClient(restaurant.slug, {
            action: currentOperation,
            from_table_id: fromTable,
            to_table_id: toTable,
          });
          await finishTransferOrMerge(fromTable, toTable, currentOperation, targetLabel, model);
        } catch (err) {
          const apiErr = err as Error & { code?: string };
          if (apiErr.code === 'session_billing') {
            notifyCheckoutLocked();
          } else {
            showToast(t.actionFailed, 'error');
          }
        }
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

      const demoTargetLabel =
        targetCandidates.find((row) => tableIdsEqual(row.id, toTable))?.display_name ?? toTable;
      const demoTargetModel = await fetchWaiterTablePageModelClient(restaurant.slug, toTable);
      await finishTransferOrMerge(
        fromTable,
        toTable,
        currentOperation,
        demoTargetLabel,
        demoTargetModel,
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
        <WaiterTableDetailHeader heading={formatWaiterTableDetailHeading(lang, '…')} />
        <div
          className={`${waiterUi.cardSurface} p-6 animate-pulse`}
          aria-busy="true"
          aria-label={t.tableDetailLoading}
        >
          <div className="h-5 w-48 rounded bg-brand-border/60 mb-4" />
          <div className="h-24 rounded bg-brand-border/40" />
        </div>
        <p className="text-sm text-brand-text-muted mt-3">{t.tableDetailLoading}</p>
        <WaiterTableBackToBoardFooter boardHref={boardHref} label={t.backToBoard} />
      </div>
    );
  }

  if (!isDemo && detailLoaded && !selectedTable) {
    return (
      <div className={pageShellClass}>
        <WaiterTableDetailHeader heading={formatWaiterTableDetailHeading(lang, displayName || '…')} />
        <div className={`${waiterUi.cardSurface} p-4 text-sm text-brand-text-muted`}>
          {t.noOrdersOnTable}
        </div>
        <WaiterTableBackToBoardFooter boardHref={boardHref} label={t.backToBoard} />
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

      finishTableClose(closeTableId);
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      setClosingDemoTable(null);
    }
  };

  const detailActions = resolveWaiterTableDetailActions({
    embeddedInDashboard,
    isDemo,
    isCheckoutPending,
    hasOpenSession,
    hasActiveBuffets: activeBuffets.length > 0,
  });

  const applyBuffetToTable = async () => {
    if (isCheckoutPending) {
      notifyCheckoutLocked();
      return;
    }

    const editorReady = isBuffetPackagesEditorReady(
      guestSnapshot,
      resolvedByBuffetId,
      buffetPriceLoading,
    );
    const blockReason = buffetOpenSubmitBlockReason(
      orders,
      guestSnapshot,
      activeBuffetIds,
      editorReady,
      hasOpenSession,
    );
    if (blockReason === 'editor_not_ready') {
      showToast(t.buffetNoRule, 'error');
      return;
    }
    if (blockReason === 'unchanged') {
      showToast(t.buffetGuestCountsUnchanged, 'info');
      return;
    }

    setBuffetSubmitting(true);
    try {
      const result = await postWaiterBuffetOpenAndCommit({
        restaurantSlug: restaurant.slug,
        tableId,
        guestSnapshot,
        activeBuffetIds,
      });
      if (!result.ok) {
        if (result.status === 409 && result.code === 'session_billing') {
          showToast(t.checkoutLockedHint, 'info');
          return;
        }
        if (result.status === 409) {
          await refresh();
          showToast(t.refreshHint, 'error');
          return;
        }
        if (result.status === 400 && result.code === 'no_price_rule') {
          showToast(t.buffetNoRule, 'error');
          return;
        }
        showToast(t.actionFailed, 'error');
        return;
      }
      applyModel(result.model);
      showToast(t.actionSuccess, 'success');
    } finally {
      setBuffetSubmitting(false);
    }
  };

  const orderLineKey = (orderId: string, itemIdx: number) => `${orderId}:${itemIdx}`;

  const executeDecrementOrderLine = async (
    orderId: string,
    itemIdx: number,
    order: Order,
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
    if (!order.items[itemIdx]) return;

    void executeDecrementOrderLine(orderId, itemIdx, order);
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
        heading={formatWaiterTableDetailHeading(lang, selectedCard.displayName)}
        updatedAtLabel={tableUpdatedLabel}
      />

      <div className="space-y-4">
        {isCheckoutPending ? <WaiterCheckoutPendingBanner message={t.checkoutPendingBanner} /> : null}

        {detailActions.showBuffetPanel ? (
          <WaiterTableBuffetPanel
            lang={lang}
            activeBuffets={activeBuffets}
            guestSnapshot={guestSnapshot}
            onSetGuestCount={setBuffetGuestCount}
            resolvedByBuffetId={resolvedByBuffetId}
            buffetPriceLoading={buffetPriceLoading}
            buffetActionLabel={buffetActionLabel}
            buffetSubmitting={buffetSubmitting}
            onSave={() => void applyBuffetToTable()}
          />
        ) : null}

        {detailActions.showOccupiedToolbar ? (
          <WaiterTableOccupiedToolbar
            t={t}
            lang={lang}
            restaurantSlug={restaurant.slug}
            tableId={selectedCard.tableId}
            sessionId={sessionMeta?.sessionId ?? null}
            menuHref={menuHref}
            isCheckoutPending={isCheckoutPending}
            onCheckoutLocked={notifyCheckoutLocked}
            onTransfer={() => openAction('transfer', selectedCard.tableId)}
            onMerge={() => openAction('merge', selectedCard.tableId)}
            showCheckoutClose={detailActions.showCheckoutClose}
            showCloseTable={detailActions.showCloseTable}
            floorStaffRole={floorStaffRole}
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
              finishTableClose(selectedCard.tableId);
            }}
          />
        ) : null}

        <WaiterTableOrderedItemsPanel
          title={t.orderedItems}
          sessionTotalText={formatWaiterOrderedItemsSessionTotal(lang, selectedCard.sessionTotal)}
          lines={selectedCard.orderLines}
          isCheckoutPending={isCheckoutPending}
          decrementingKey={decrementingKey}
          orderLineKey={orderLineKey}
          onDecrement={(orderId, itemIdx) => void handleDecrementOrderLine(orderId, itemIdx)}
        />
      </div>

      <WaiterTableBackToBoardFooter boardHref={boardHref} label={t.backToBoard} />

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
              className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 text-base text-brand-text"
            />
          </div>
          <div>
            <label className="text-[13px] text-brand-text-muted block mb-1.5">{t.targetTable}</label>
            <select
              value={targetTable ?? ''}
              onChange={(e) => setTargetTable(e.target.value || null)}
              disabled={actionTargetsLoading}
              className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 text-base text-brand-text focus:outline-none focus:border-brand-gold/40 disabled:opacity-60"
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
    </div>
  );
}

export function WaiterTableDetail(props: Props) {
  return <WaiterTableDetailInner {...props} />;
}
