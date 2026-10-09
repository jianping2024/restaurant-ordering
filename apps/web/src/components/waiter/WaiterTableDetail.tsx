'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Order, CartItem } from '@/types';
import { resolveBuffetFormAlignState, type ResolvedBuffetPriceRow } from '@/lib/buffet-order';
import { isTableSessionOpen } from '@/lib/guest-table-ordering';
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
import { WaiterStaffOrderingPanel } from '@/components/waiter/WaiterStaffOrderingPanel';
import { useWaiterTableBuffetForm } from '@/components/waiter/useWaiterTableBuffetForm';
import { useWaiterBuffetOpenMutation } from '@/components/waiter/useWaiterBuffetOpenMutation';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { formatWaiterTableDetailHeading, formatWaiterOrderedItemsSessionTotal } from '@/lib/waiter-table-detail-display';
import { formatChargeableShareHint } from '@/lib/format-chargeable-share-hint';
import { buildWaiterTableCard } from '@/components/waiter/waiter-table-card';
import type { FloorBoardCapabilities } from '@/lib/floor-board-capabilities';
import {
  fromCapabilitiesPayload,
  type CapabilitiesPayload,
} from '@/lib/permissions/can';
import { isRestaurantFeatureEnabled } from '@/lib/restaurant-features';
import { KITCHEN_READY_AFTER_MINUTES_DEFAULT } from '@/lib/print-agent-config';
import { isWaiterTableCardOccupied } from '@/lib/waiter-table-occupancy';
import { waiterUi } from '@/components/waiter/waiter-ui';
import { ModalConfirmActions } from '@/components/ui/ModalConfirmActions';
import { postWaiterDecrementOrderItemClient } from '@/lib/waiter-decrement-order-item-client';
import { applyOrderUpdateToWaiterDetail } from '@/lib/waiter-table-detail-apply-order';
import { sessionHasUnsentRoundBasket } from '@/lib/table-order-round/unsent-basket';
import {
  fetchWaiterTableActionTargetsClient,
  fetchWaiterTablePageModelClient,
  postWaiterTableActionClient,
} from '@/lib/staff-board-client';
import {
  clearPublishedWaiterTablePageModel,
  commitAuthoritativeWaiterTablePageModel,
  commitWaiterSessionRelocation,
} from '@/lib/waiter-staff-mutation-sync';
import {
  buildWaiterTableDetailBootFromBoard,
  isAuthoritativeIdleWaiterTableBoot,
} from '@/lib/waiter-table-detail-scope';
import { patchWaiterTableModelAfterStaffAppend, buildOptimisticOrderAfterStaffAppend } from '@/lib/staff-order-append-optimistic-patch';
import type { MenuOrderSubmitSuccess } from '@/lib/menu-order-submit';
import type { CustomerMenuCatalog } from '@/lib/customer-menu-catalog-client-cache';
import { filterWaiterTableActionTargets } from '@/lib/waiter-table-occupancy';
import { useWaiterBoardOptional } from '@/components/dashboard/WaiterBoardProvider';
import { distinctMenuItemIdsFromOrders, menuItemCodeLookupFromRows } from '@/lib/menu-item-code';
import { tableIdsEqual, type RestaurantTableRow } from '@/lib/restaurant-tables';
import {
  partyIdForTable,
  tablePartyMemberTableIds,
} from '@/lib/table-party-groups';
import {
  dashboardCheckoutTableHref,
  waiterBoardHref,
  waiterTableHref,
} from '@/lib/staff-routes';
import type { WaiterTableDetailData } from '@/lib/staff-board';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import { normalizeWaiterTablePageModel } from '@/lib/waiter-table-detail-normalize';
import { useWaiterDetailSessionBusy } from '@/lib/use-waiter-detail-session-busy';
import {
  WaiterCheckoutPendingBanner,
  WaiterTableBuffetPanel,
  WaiterTableOccupiedToolbar,
  WaiterTableOrderedItemsPanel,
} from '@/components/waiter/WaiterTableDetailLayout';
import {
  useStaffSessionPreBillPrint,
} from '@/lib/use-staff-checkout-bill-print';
import { resolveWaiterTableDetailActions } from '@/lib/waiter-table-detail-actions';
import { isCheckoutPending as sessionIsCheckoutPending } from '@/lib/waiter-board-session';
import {
  WaiterTableBackToBoardFooter,
  WaiterTableDetailContentSkeleton,
  WaiterTableDetailFooterPlaceholder,
  waiterDetailLayout,
} from '@/components/waiter/waiter-table-detail-ui';
import type { FloorBoardRestaurant } from '@/lib/floor-board-restaurant';

/** Stable empty map — avoids buffet-form effect loops when model not yet loaded. */
const EMPTY_BUFFET_PRICES: Record<string, ResolvedBuffetPriceRow | null> = {};

interface Props {
  restaurant: FloorBoardRestaurant;
  /** Authoritative boot model — skip mount entry reconcile when true. */
  hasAuthoritativeSeed?: boolean;
  /** Demo only — all configured tables for transfer/merge UI. */
  tables?: RestaurantTableRow[];
  /** Demo only — full demo order set. */
  initialOrders?: Order[];
  /** Optional boot model (demo / published bridge via hook peek). */
  initialModel?: WaiterTablePageModel | null;
  tableId: string;
  /** Demo only — table label before detail state resolves. */
  displayName?: string;
  isDemo?: boolean;
  embeddedInDashboard?: boolean;
  /** Floor board capabilities — drives close/checkout UI and decrement controls. */
  floorCapabilities: FloorBoardCapabilities;
  /** RSC-safe staff capabilities for API permissions. */
  capabilities: CapabilitiesPayload;
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
  floorCapabilities,
  capabilities: capabilitiesPayload,
}: Props) {
  const router = useRouter();
  const waiterBoard = useWaiterBoardOptional();
  const { lang } = useLanguage();
  const locale = UI_LOCALE_BY_LANG[lang];
  const t = WAITER_TEXT[lang];
  const capabilities = fromCapabilitiesPayload(capabilitiesPayload);
  const boardBoot = useMemo(() => {
    if (!embeddedInDashboard || !waiterBoard) return null;
    return buildWaiterTableDetailBootFromBoard(
      {
        tables: waiterBoard.tables,
        sessionMetaByTableId: waiterBoard.sessionMetaByTableId,
        openTableDefaults: waiterBoard.openTableDefaults,
        partyMembers: waiterBoard.partyMembers,
        checkoutRequestedTableIds: waiterBoard.checkoutRequestedTableIds,
        checkoutRequestedAtByTableId: waiterBoard.checkoutRequestedAtByTableId,
      },
      tableId,
    );
  }, [embeddedInDashboard, tableId, waiterBoard]);
  const resolvedInitialModel = initialModel ?? boardBoot;
  // Published seed / idle board boot skip mount pull; occupied chrome stub still reconciles orders.
  const skipEntryReconcile =
    hasAuthoritativeSeed || isAuthoritativeIdleWaiterTableBoot(boardBoot);
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
    paintPhase,
    activeSessionByTableId,
    demoTables,
  } = useWaiterTableDetail(
    restaurant,
    tableId,
    !isDemo,
    isDemo,
    demoTablesProp,
    initialOrders,
    resolvedInitialModel,
    skipEntryReconcile,
    embeddedInDashboard ? waiterBoard?.openTableDefaults ?? null : null,
  );
  const isCheckoutPending = sessionIsCheckoutPending(sessionMeta);

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
  const [mergeHasActiveRoundBasket, setMergeHasActiveRoundBasket] = useState(false);
  const {
    busy: detailSessionBusy,
    kind: detailSessionBusyKind,
    tryBegin: tryBeginDetailSessionBusy,
    end: endDetailSessionBusy,
  } = useWaiterDetailSessionBusy();
  const [demoCloseConfirmTableId, setDemoCloseConfirmTableId] = useState<string | null>(null);
  const [decrementingKey, setDecrementingKey] = useState<string | null>(null);
  const [servingKey, setServingKey] = useState<string | null>(null);
  const [orderingOpen, setOrderingOpen] = useState(false);
  const [cartDraft, setCartDraft] = useState<CartItem[]>([]);
  /**
   * Board→detail click-through guard: occupied chrome boots under the same pointer up.
   * CSS blocks hit-testing until armed; ref ignores late handler delivery.
   */
  const detailActionsArmedRef = useRef(false);
  const [detailActionsArmed, setDetailActionsArmed] = useState(false);
  useEffect(() => {
    detailActionsArmedRef.current = false;
    setDetailActionsArmed(false);
    const timer = window.setTimeout(() => {
      detailActionsArmedRef.current = true;
      setDetailActionsArmed(true);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [tableId]);
  const whenDetailActionsArmed = useCallback((action: () => void) => {
    if (!detailActionsArmedRef.current) return;
    action();
  }, []);
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
    buffetPricesByBuffetId: model?.buffetPricesByBuffetId ?? EMPTY_BUFFET_PRICES,
    isDemo,
    supabase,
  });
  const buffetEditorReady = isBuffetPackagesEditorReady(
    guestSnapshot,
    resolvedByBuffetId,
    buffetPriceLoading,
  );

  useEffect(() => {
    setOperationType(null);
    setSourceTable(null);
    setTargetTable(null);
    setActionTargets([]);
    setActionTargetsLoading(false);
    endDetailSessionBusy();
    setDecrementingKey(null);
    setItemCodeByMenuId({});
    setOrderingOpen(false);
    setCartDraft([]);
  }, [tableId, endDetailSessionBusy]);

  useEffect(() => {
    if (!orderingOpen) return;
    if (isCheckoutPending) {
      setOrderingOpen(false);
    }
  }, [isCheckoutPending, orderingOpen]);

  const applyDetail = useCallback(
    (detail: WaiterTableDetailData) => {
      applyModel({
        detail,
        buffets: model?.buffets ?? [],
        buffetPricesByBuffetId: model?.buffetPricesByBuffetId ?? EMPTY_BUFFET_PRICES,
        inTableParty: model?.inTableParty ?? false,
      });
    },
    [applyModel, model?.buffetPricesByBuffetId, model?.buffets, model?.inTableParty],
  );

  const selectedDisplayName = selectedTable?.display_name || displayName;

  const floorCaps = floorCapabilities;
  const {
    printSessionPreBill,
    isPrintPreBillBusy,
  } = useStaffSessionPreBillPrint(restaurant.slug);

  // Removed menuDecrementOperator - now using capabilities directly

  const serveEnabled = isRestaurantFeatureEnabled(
    restaurant.feature_flags,
    'kitchen_serve_to_table',
  );

  const selectedCard = useMemo(
    () =>
      buildWaiterTableCard(
        tableId,
        selectedDisplayName,
        orders,
        itemCodeByMenuId,
        capabilities,
        {
          serveEnabled,
          readyAfterMinutes:
            restaurant.kitchen_ready_after_minutes ?? KITCHEN_READY_AFTER_MINUTES_DEFAULT,
          nowMs: Date.now(),
          lang,
          kitchenEnabledStationIds: restaurant.kitchen_enabled_station_ids ?? [],
        },
      ),
    [
      orders,
      tableId,
      selectedDisplayName,
      itemCodeByMenuId,
      capabilities,
      serveEnabled,
      restaurant.kitchen_ready_after_minutes,
      restaurant.kitchen_enabled_station_ids,
      lang,
    ],
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

  const notifyPartyBlocksTransferMerge = useCallback(() => {
    showToast(t.partyBlocksTransferMerge, 'info');
  }, [t.partyBlocksTransferMerge]);

  const inTableParty = useMemo(() => {
    if (isDemo) return false;
    if (waiterBoard) {
      return partyIdForTable(waiterBoard.partyMembers, tableId) != null;
    }
    return model?.inTableParty === true;
  }, [isDemo, model?.inTableParty, tableId, waiterBoard]);

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

  const demoActiveTableIds = useMemo(() => {
    if (!isDemo) return [] as string[];
    return demoTables
      .filter((table) => {
        const view = ordersForWaiterTableView(table.id, initialOrders, activeSessionByTableId);
        const c = buildWaiterTableCard(table.id, table.display_name, view, itemCodeByMenuId, capabilities, {
          serveEnabled,
          readyAfterMinutes:
            restaurant.kitchen_ready_after_minutes ?? KITCHEN_READY_AFTER_MINUTES_DEFAULT,
          lang,
        });
        return isWaiterTableCardOccupied(c);
      })
      .map((row) => row.id);
  }, [activeSessionByTableId, demoTables, initialOrders, isDemo, itemCodeByMenuId, capabilities, serveEnabled, lang]);

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
    if (!isCheckoutPending) return;
    if (floorCaps.canAssistBillCheckout) {
      router.replace(dashboardCheckoutTableHref(tableId));
      return;
    }
    router.replace(waiterBoardHref(restaurant.slug, routeOptions));
  }, [
    detailLoaded,
    floorCaps.canAssistBillCheckout,
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

  const catalogPrefetch = useMemo(
    () => ({ restaurantId: restaurant.id, slug: restaurant.slug }),
    [restaurant.id, restaurant.slug],
  );

  useStaffAssistedMenuEntryPrefetch(
    catalogPrefetch,
    hasOpenSession && !isCheckoutPending && !isDemo && detailLoaded,
  );

  const handleStaffAppendSuccess = useCallback(
    (
      result: MenuOrderSubmitSuccess,
      submittedCart: CartItem[],
      catalog: CustomerMenuCatalog,
    ) => {
      const appendResult =
        isDemo && result.orderId === 'demo-order' && orders[0]
          ? {
              ...result,
              orderId: orders[0].id,
              sessionId: orders[0].session_id ?? result.sessionId,
            }
          : result;

      const optimisticInput = {
        orders,
        append: appendResult,
        cart: submittedCart,
        menuItems: catalog.menuItems,
        restaurantId: restaurant.id,
        tableId,
        displayName: selectedDisplayName,
      };

      if (model) {
        const next = patchWaiterTableModelAfterStaffAppend(model, optimisticInput);
        applyModel(next);
        commitAuthoritativeWaiterTablePageModel(next);
        return;
      }

      if (!isDemo) return;

      const order = buildOptimisticOrderAfterStaffAppend(optimisticInput);
      applyDetail(applyOrderUpdateToWaiterDetail(currentTableDetail(), order));
    },
    [
      applyDetail,
      applyModel,
      currentTableDetail,
      isDemo,
      model,
      orders,
      restaurant.id,
      selectedDisplayName,
      tableId,
    ],
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
        tablePartyMemberTableIds(waiterBoard.partyMembers),
      );
    },
    [waiterBoard],
  );

  const openAction = (type: 'transfer' | 'merge', sourceId: string) => {
    if (detailSessionBusy) return;
    if (tableIdsEqual(sourceId, tableId) && isCheckoutPending) {
      notifyCheckoutLocked();
      return;
    }
    if (tableIdsEqual(sourceId, tableId) && inTableParty) {
      notifyPartyBlocksTransferMerge();
      return;
    }
    setOperationType(type);
    setSourceTable(sourceId);
    setTargetTable(null);
    setActionTargets([]);
    setMergeHasActiveRoundBasket(false);
    if (isDemo) return;

    if (type === 'merge') {
      const sourceSessionId =
        waiterBoard?.sessionMetaByTableId?.[sourceId]?.sessionId ??
        (tableIdsEqual(sourceId, tableId) ? sessionMeta?.sessionId : null) ??
        null;
      if (sourceSessionId) {
        void sessionHasUnsentRoundBasket(supabase, sourceSessionId)
          .then(setMergeHasActiveRoundBasket)
          .catch(() => setMergeHasActiveRoundBasket(false));
      }
    }

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
    setMergeHasActiveRoundBasket(false);
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
    if (inTableParty) {
      notifyPartyBlocksTransferMerge();
      return;
    }
    if (tableIdsEqual(sourceTable, targetTable)) {
      showToast(t.sameTableError, 'error');
      return;
    }

    const currentOperation = operationType;
    const fromTable = sourceTable;
    const toTable = targetTable;
    if (!tryBeginDetailSessionBusy('transfer_merge')) return;
    let keepBusy = false;
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
          keepBusy = true;
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

      const { data: authData } = await supabase.auth.getUser();
      const operatorUserId = authData.user?.id ?? null;

      const { data: rpcResult, error } = currentOperation === 'transfer'
        ? await supabase.rpc('transfer_table_session', {
          p_restaurant_id: restaurant.id,
          p_from_table_id: fromTable,
          p_to_table_id: toTable,
          p_operator_user_id: operatorUserId,
        })
        : await supabase.rpc('merge_table_sessions', {
          p_restaurant_id: restaurant.id,
          p_source_table_id: fromTable,
          p_target_table_id: toTable,
          p_operator_user_id: operatorUserId,
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
      keepBusy = true;
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      if (!keepBusy) endDetailSessionBusy();
    }
  };

  const demoCloseConfirmCopy = useMemo(
    () => ({
      title: t.closeTableConfirmTitle,
      message: t.closeTableConfirmMessage,
    }),
    [t],
  );

  const orderedItemsSessionAmount = formatWaiterOrderedItemsSessionTotal(
    lang,
    selectedCard.sessionTotal,
    selectedCard.mealsTotal,
  );
  /** Pre-bill is independent of amount chrome (may show when amounts are hidden). */
  const orderedItemsPreBillPrint = useMemo(() => {
    const sessionId = sessionMeta?.sessionId ?? null;
    if (isDemo || !floorCaps.canPrintSessionPreBill || !sessionId) {
      return null;
    }
    return {
      label: t.printPreBill,
      busy: isPrintPreBillBusy(sessionId) || detailSessionBusyKind === 'pre_bill',
      disabled: detailSessionBusy && detailSessionBusyKind !== 'pre_bill',
      onPrint: () => {
        if (!tryBeginDetailSessionBusy('pre_bill')) return;
        void printSessionPreBill(selectedCard.tableId, sessionId).finally(() => {
          endDetailSessionBusy();
        });
      },
    };
  }, [
    detailSessionBusy,
    detailSessionBusyKind,
    endDetailSessionBusy,
    floorCaps.canPrintSessionPreBill,
    isDemo,
    isPrintPreBillBusy,
    printSessionPreBill,
    selectedCard.tableId,
    sessionMeta?.sessionId,
    t.printPreBill,
    tryBeginDetailSessionBusy,
  ]);

  const closeDemoTable = async (closeTableId: string) => {
    if (!tryBeginDetailSessionBusy('demo_close')) return;
    let keepBusy = false;
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

      keepBusy = true;
      finishTableClose(closeTableId);
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      if (!keepBusy) endDetailSessionBusy();
    }
  };

  const detailActions = resolveWaiterTableDetailActions({
    caps: floorCaps,
    isDemo,
    isCheckoutPending,
    hasOpenSession,
    hasActiveBuffets: activeBuffets.length > 0,
  });

  const { submitting: buffetSubmitting, submit: submitBuffetOpen } = useWaiterBuffetOpenMutation({
    lang,
    restaurantSlug: restaurant.slug,
    tableId,
    orders,
    guestSnapshot,
    activeBuffetIds,
    hasOpenSession,
    editorReady: buffetEditorReady,
    autosave: detailActions.showBuffetPanel && hasOpenSession && !detailSessionBusy,
    onSuccess: applyModel,
    onStaleConflict: () => {
      void refresh();
    },
  });

  const orderLineKey = (orderId: string, itemIdx: number) => `${orderId}:${itemIdx}`;

  const executeDecrementOrderLine = async (
    orderId: string,
    itemIdx: number,
    order: Order,
  ) => {
    if (!tryBeginDetailSessionBusy('order_line')) return;
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
      if (apiErr.status === 409 && apiErr.code === 'claimed_by_ticket') {
        showToast(t.claimedByTicket, 'error');
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
      endDetailSessionBusy();
    }
  };

  const handleDecrementOrderLine = (orderId: string, itemIdx: number) => {
    if (isCheckoutPending) {
      notifyCheckoutLocked();
      return;
    }
    if (detailSessionBusy) return;
    const order = orders.find((row) => row.id === orderId);
    if (!order) return;
    if (!order.items[itemIdx]) return;

    void executeDecrementOrderLine(orderId, itemIdx, order);
  };

  const handleServeOrderLine = async (orderId: string, itemIdx: number) => {
    if (isCheckoutPending) {
      notifyCheckoutLocked();
      return;
    }
    if (isDemo) {
      showToast(t.actionFailed, 'error');
      return;
    }
    if (!tryBeginDetailSessionBusy('order_line')) return;
    const key = orderLineKey(orderId, itemIdx);
    setServingKey(key);
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(restaurant.slug)}/staff/kitchen/serve`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selections: [{ order_id: orderId, item_index: itemIdx }],
          }),
        },
      );
      if (!res.ok) {
        if (res.status === 409) {
          showToast(t.refreshHint, 'error');
          await refresh();
          return;
        }
        showToast(t.actionFailed, 'error');
        return;
      }
      await refresh();
      showToast(t.serveDone, 'success');
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      setServingKey(null);
      endDetailSessionBusy();
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
        <div className="mb-4 rounded-xl border border-brand-ink/35 bg-brand-ink/10 px-4 py-3">
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
        heading={formatWaiterTableDetailHeading(
          lang,
          selectedCard.displayName || selectedDisplayName || '…',
        )}
        updatedAtLabel={paintPhase === 'cold' ? undefined : tableUpdatedLabel}
      />

      <div className={waiterDetailLayout.pageBodySlot}>
        {paintPhase === 'cold' ? (
          <WaiterTableDetailContentSkeleton label={t.tableDetailLoading} />
        ) : !selectedTable ? (
          paintPhase === 'ready' ? (
            <div className={`${waiterUi.cardSurface} p-4 text-sm text-brand-text-muted`}>
              {t.noOrdersOnTable}
            </div>
          ) : (
            <WaiterTableDetailContentSkeleton label={t.tableDetailLoading} />
          )
        ) : (
          <div className={`space-y-4${detailActionsArmed ? '' : ' pointer-events-none'}`}>
            {isCheckoutPending ? <WaiterCheckoutPendingBanner message={t.checkoutPendingBanner} /> : null}

            {detailActions.showBuffetPanel ? (
              <WaiterTableBuffetPanel
                lang={lang}
                activeBuffets={activeBuffets}
                guestSnapshot={guestSnapshot}
                onSetGuestCount={(buffetId, which, value) => {
                  whenDetailActionsArmed(() => {
                    if (detailSessionBusy) return;
                    setBuffetGuestCount(buffetId, which, value);
                  });
                }}
                resolvedByBuffetId={resolvedByBuffetId}
                buffetPriceLoading={buffetPriceLoading}
                sessionBusy={detailSessionBusy}
                confirmOpen={
                  hasOpenSession
                    ? null
                    : {
                        label: t.buffetConfirm,
                        submitting:
                          buffetSubmitting || detailSessionBusyKind === 'buffet_open',
                        onConfirm: () =>
                          whenDetailActionsArmed(() => {
                            if (!tryBeginDetailSessionBusy('buffet_open')) return;
                            void submitBuffetOpen().finally(() => {
                              endDetailSessionBusy();
                            });
                          }),
                      }
                }
              />
            ) : null}

            {detailActions.showOccupiedToolbar ? (
              <WaiterTableOccupiedToolbar
                t={t}
                lang={lang}
                restaurantSlug={restaurant.slug}
                tableId={selectedCard.tableId}
                sessionId={sessionMeta?.sessionId ?? null}
                onContinueOrdering={() => {
                  whenDetailActionsArmed(() => {
                    if (detailSessionBusy) return;
                    // Do not router.refresh() here — RSC remount races the catalog panel and
                    // can leave Continuar pedido stuck on "…" despite a warm client cache.
                    setOrderingOpen(true);
                  });
                }}
                isCheckoutPending={isCheckoutPending}
                inTableParty={inTableParty}
                onCheckoutLocked={notifyCheckoutLocked}
                onTransfer={() => whenDetailActionsArmed(() => openAction('transfer', selectedCard.tableId))}
                onMerge={() => whenDetailActionsArmed(() => openAction('merge', selectedCard.tableId))}
                showTransfer={detailActions.showTransfer}
                showMerge={detailActions.showMerge}
                showCallCheckout={detailActions.showCallCheckout}
                showForceClose={detailActions.showForceClose}
                isDemo={isDemo}
                sessionBusy={detailSessionBusy}
                sessionBusyKind={detailSessionBusyKind}
                tryBeginSessionBusy={tryBeginDetailSessionBusy}
                endSessionBusy={endDetailSessionBusy}
                onDemoCloseClick={() => {
                  whenDetailActionsArmed(() => {
                    if (detailSessionBusy) return;
                    if (isCheckoutPending) {
                      void closeDemoTable(selectedCard.tableId);
                      return;
                    }
                    setDemoCloseConfirmTableId(selectedCard.tableId);
                  });
                }}
                onTableClosed={() => {
                  finishTableClose(selectedCard.tableId);
                }}
              />
            ) : null}

            {paintPhase === 'ready' ? (
              <WaiterTableOrderedItemsPanel
                title={t.orderedItems}
                showAmounts={floorCaps.canViewTableDetailAmounts}
                sessionAmount={orderedItemsSessionAmount}
                preBillPrint={orderedItemsPreBillPrint}
                lines={selectedCard.orderLines}
                formatChargeableHint={(qty, unitPrice) =>
                  formatChargeableShareHint(lang, qty, unitPrice)
                }
                isCheckoutPending={isCheckoutPending}
                sessionBusy={detailSessionBusy}
                decrementingKey={decrementingKey}
                servingKey={servingKey}
                orderLineKey={orderLineKey}
                onDecrement={(orderId, itemIdx) => void handleDecrementOrderLine(orderId, itemIdx)}
                onServe={(orderId, itemIdx) => void handleServeOrderLine(orderId, itemIdx)}
                serveLabel={t.serveToTable}
              />
            ) : (
              <WaiterTableDetailContentSkeleton label="" density="ordered" />
            )}
          </div>
        )}
      </div>

      <div className={waiterDetailLayout.pageFooterSlot}>
        {paintPhase === 'ready' ? (
          <WaiterTableBackToBoardFooter boardHref={boardHref} label={t.backToBoard} />
        ) : (
          <WaiterTableDetailFooterPlaceholder />
        )}
      </div>

      {paintPhase !== 'cold' ? (
        <>
          <WaiterStaffOrderingPanel
            open={orderingOpen}
            title={t.continueOrdering}
            onClose={() => setOrderingOpen(false)}
            restaurant={restaurant}
            tableId={tableId}
            displayName={selectedDisplayName}
            sessionMeta={sessionMeta}
            orders={orders}
            cartDraft={cartDraft}
            onCartDraftChange={setCartDraft}
            onStaffAppendSuccess={handleStaffAppendSuccess}
            isDemo={isDemo}
            embeddedInDashboard={embeddedInDashboard}
          />

          <Modal
            open={!!operationType}
            onClose={closeAction}
            title={operationType === 'transfer' ? t.transferTitle : t.mergeTitle}
            size="sm"
          >
            <p className="text-[13px] text-brand-text-muted mb-4">
              {operationType === 'transfer' ? t.transferHint : t.mergeHint}
            </p>
            {operationType === 'merge' && mergeHasActiveRoundBasket ? (
              <p className="mb-4 rounded-lg border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-[13px] text-brand-text">
                {t.mergeRoundBasketWarning}
              </p>
            ) : null}
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
            <ModalConfirmActions
              className="mt-5"
              cancelLabel={lang === 'zh' ? '取消' : lang === 'en' ? 'Cancel' : 'Cancelar'}
              confirmLabel={operationType === 'transfer' ? t.confirmTransfer : t.confirmMerge}
              onCancel={closeAction}
              onConfirm={() => void handleActionSubmit()}
              busy={detailSessionBusyKind === 'transfer_merge'}
              confirmDisabled={!sourceTable || !targetTable || detailSessionBusy}
            />
          </Modal>
          {isDemo ? (
            <ConfirmModal
              open={demoCloseConfirmTableId != null}
              onClose={() => {
                if (detailSessionBusyKind === 'demo_close') return;
                setDemoCloseConfirmTableId(null);
              }}
              title={demoCloseConfirmCopy.title}
              message={demoCloseConfirmCopy.message}
              confirmLabel={t.closeTableConfirmButton}
              cancelLabel={t.closeTableCancel}
              variant="danger"
              confirming={detailSessionBusyKind === 'demo_close'}
              onConfirm={async () => {
                if (!demoCloseConfirmTableId) return;
                const closeTableId = demoCloseConfirmTableId;
                setDemoCloseConfirmTableId(null);
                await closeDemoTable(closeTableId);
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function WaiterTableDetail(props: Props) {
  return <WaiterTableDetailInner {...props} />;
}
