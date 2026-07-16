'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItemStatus } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { VoidItemReasonDialog } from '@/lib/order-item-void/VoidItemReasonDialog';
import { voidItemReasonErrorMessage } from '@/lib/order-item-void/void-item-reason-ui';
import { patchStaffOrderItemsClient } from '@/lib/order-item-void/patch-staff-order-items-client';
import { deriveOrderStatusFromItems, itemsEveryVoided, normalizeOrderItemStatus } from '@/lib/order-status';
import { isBuffetBaseItem, orderItemBatchKey } from '@/lib/order-items';
import { StaffAuthenticatedShell, type StaffShellContext } from '@/components/staff/StaffAuthenticatedShell';
import { StaffPersonalSettingsMenu } from '@/components/staff/StaffPersonalSettingsMenu';
import { StaffPersonalTopBar } from '@/components/staff/StaffPersonalTopBar';
import { fetchKitchenBoardClient } from '@/lib/staff-board-client';
import { staffRolePath } from '@/lib/staff-routes';
import { topBarRoleLabel } from '@/lib/top-bar-role-label';
import { useRestaurantRealtimeRefresh, useRestaurantStaffEntryReconcile } from '@/lib/use-restaurant-realtime-refresh';
import { playCheckoutRequestChime } from '@/lib/checkout-notification-sound';
import { compareRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';

interface Props {
  restaurant: { id: string; name: string; slug: string };
  asOwner?: boolean;
  /** SSR successfully loaded board — skip mount entry reconcile. */
  hasAuthoritativeSeed?: boolean;
  initialOrders?: Order[];
  /** 开台 / 结账中（table_sessions open|billing）的 table_id，用于无待备餐单时在厨房占位 */
  initialActiveTableIds?: string[];
  initialTables?: RestaurantTableRow[];
  isDemo?: boolean;
}

const KITCHEN_DEMO_TEXT = {
  zh: {
    title: '演示后厨',
    enter: '进入演示后厨',
    passwordHint: '演示密码',
    step: '第 2/3 步：后厨实时接收并更新出餐状态。',
    openCustomer: '打开顾客视图',
    openWaiter: '打开服务员看板',
    backHub: '返回演示首页',
    conflict: '订单已被其他设备更新，已自动刷新，请重试刚才操作。',
  },
  en: {
    title: 'Demo Kitchen',
    enter: 'Enter demo kitchen',
    passwordHint: 'Demo password',
    step: 'Step 2/3: kitchen receives and updates dish status in real time.',
    openCustomer: 'Open customer view',
    openWaiter: 'Open waiter dashboard',
    backHub: 'Back to demo hub',
    conflict: 'Order was updated on another device. Data has been refreshed, please retry.',
  },
  pt: {
    title: 'Cozinha demo',
    enter: 'Entrar na cozinha demo',
    passwordHint: 'Senha demo',
    step: 'Passo 2/3: a cozinha recebe e atualiza os pratos em tempo real.',
    openCustomer: 'Abrir visao do cliente',
    openWaiter: 'Abrir painel do garcom',
    backHub: 'Voltar ao hub demo',
    conflict: 'O pedido foi atualizado em outro dispositivo. A lista foi atualizada, tente novamente.',
  },
} as const;

export function KitchenDisplay(props: Props) {
  return (
    <StaffAuthenticatedShell
      restaurant={props.restaurant}
      expectedRole="kitchen"
      asOwner={props.asOwner}
      isDemo={props.isDemo}
    >
      {(ctx) => <KitchenDisplayInner {...props} {...ctx} />}
    </StaffAuthenticatedShell>
  );
}

function buildInitialTableMeta(tables: RestaurantTableRow[] = []): Map<string, RestaurantTableRow> {
  return new Map(tables.map((t) => [t.id, t]));
}

function KitchenDisplayInner({
  restaurant,
  asOwner = false,
  hasAuthoritativeSeed = false,
  initialOrders = [],
  initialActiveTableIds = [],
  initialTables = [],
  isDemo = false,
  handleSignOut,
  exitLabel,
  confirmBeforeSignOut,
}: Props & StaffShellContext) {
  const { lang } = useLanguage();
  const t = getMessages(lang).kitchen;
  const demoText = KITCHEN_DEMO_TEXT[lang];
  const roleLabel = topBarRoleLabel(lang, asOwner ? 'owner' : 'kitchen');
  const locale = UI_LOCALE_BY_LANG[lang];
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeTableIds, setActiveTableIds] = useState<string[]>(initialActiveTableIds);
  const [tableMetaById, setTableMetaById] = useState<Map<string, RestaurantTableRow>>(
    () => buildInitialTableMeta(initialTables),
  );
  const [updateConflict, setUpdateConflict] = useState(false);
  const [pendingVoid, setPendingVoid] = useState<{ order: Order; itemIdx: number } | null>(null);
  const [voidReasonError, setVoidReasonError] = useState<string | null>(null);
  const [voidingItem, setVoidingItem] = useState(false);
  const prevOrderIds = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));
  const supabase = createClient(); // demo realtime only

  /** 主区只显示待处理 / 备餐中（出餐完毕的订单从列表移除） */
  const boardOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending' || o.status === 'cooking'),
    [orders],
  );

  const idleTableCount = useMemo(() => {
    const busy = new Set(boardOrders.map((o) => o.table_id));
    return activeTableIds.filter((id) => !busy.has(id)).length;
  }, [boardOrders, activeTableIds]);

  const kitchenColumns = useMemo(() => {
    const tableLabel = (tableId: string, fallback?: string) =>
      fallback?.trim()
      || tableMetaById.get(tableId)?.display_name
      || tableId.slice(0, 8);

    const byTable = new Map<string, Order[]>();
    boardOrders.forEach((o) => {
      const list = byTable.get(o.table_id) || [];
      list.push(o);
      byTable.set(o.table_id, list);
    });
    byTable.forEach((list) => {
      list.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    });
    const tableIds = new Set<string>([...activeTableIds, ...Array.from(byTable.keys())]);
    const sortedTables = Array.from(tableIds).sort((a, b) => {
      const ta = tableMetaById.get(a) ?? { sort_order: 9999, display_name: tableLabel(a) };
      const tb = tableMetaById.get(b) ?? { sort_order: 9999, display_name: tableLabel(b) };
      return compareRestaurantTables(ta, tb);
    });
    type Col = { kind: 'order'; order: Order } | { kind: 'placeholder'; tableId: string; displayName: string };
    const cols: Col[] = [];
    for (const tableId of sortedTables) {
      const list = byTable.get(tableId);
      if (list?.length) {
        list.forEach((order) => cols.push({ kind: 'order', order }));
      } else if (activeTableIds.includes(tableId)) {
        cols.push({
          kind: 'placeholder',
          tableId,
          displayName: tableLabel(tableId),
        });
      }
    }
    return cols;
  }, [boardOrders, activeTableIds, tableMetaById]);

  const refreshKitchenBoard = useCallback(async () => {
    const board = await fetchKitchenBoardClient(restaurant.slug);
    board.orders.forEach((o) => {
      if (!prevOrderIds.current.has(o.id)) {
        playCheckoutRequestChime();
        prevOrderIds.current.add(o.id);
      }
    });
    setOrders(board.orders);
    setActiveTableIds(board.activeTableIds);
    setTableMetaById(board.tableById);
  }, [restaurant.slug]);

  // 更新菜品级状态，并同步订单总状态（pending/cooking/done）
  const updateItemStatus = async (order: Order, itemIdx: number, nextStatus: OrderItemStatus) => {
    if (nextStatus === 'voided' && !isDemo) {
      setVoidReasonError(null);
      setPendingVoid({ order, itemIdx });
      return;
    }

    setUpdateConflict(false);
    const nextItems = order.items.map((item, idx) => {
      if (idx !== itemIdx) return item;
      return {
        ...item,
        item_status: nextStatus,
        started_at: nextStatus === 'cooking' ? new Date().toISOString() : item.started_at,
        done_at: nextStatus === 'done' ? new Date().toISOString() : item.done_at,
        voided_at: nextStatus === 'voided' ? new Date().toISOString() : item.voided_at,
      };
    });

    if (isDemo) {
      const nextOrderStatus = deriveOrderStatusFromItems(nextItems);
      const { error } = await supabase
        .from('orders')
        .update({ items: nextItems, status: nextOrderStatus })
        .eq('id', order.id)
        .eq('updated_at', order.updated_at);
      if (!error) {
        const updatedAt = new Date().toISOString();
        const merged: Order = {
          ...order,
          items: nextItems,
          status: nextOrderStatus,
          updated_at: updatedAt,
        };
        if (nextOrderStatus === 'done') {
          setOrders((prev) => prev.filter((o) => o.id !== order.id));
        } else {
          setOrders((prev) =>
            prev.map((o) => (o.id === order.id ? merged : o)),
          );
        }
        return;
      }
    }

    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(restaurant.slug)}/staff/kitchen/orders/${order.id}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: nextItems, updated_at: order.updated_at }),
      },
    );

    if (res.ok) {
      await refreshKitchenBoard();
      return;
    }

    if (res.status === 409) {
      setUpdateConflict(true);
      await refreshKitchenBoard();
      return;
    }

    throw new Error('kitchen_update_failed');
  };

  const performKitchenVoid = async (reason: string, detail: string) => {
    if (!pendingVoid) return;
    const { order, itemIdx } = pendingVoid;
    setVoidingItem(true);
    setVoidReasonError(null);
    setUpdateConflict(false);
    try {
      const nextItems = order.items.map((item, idx) => {
        if (idx !== itemIdx) return item;
        return {
          ...item,
          item_status: 'voided' as const,
          voided_at: new Date().toISOString(),
          void_reason: reason,
        };
      });

      const result = await patchStaffOrderItemsClient('kitchen', restaurant.slug, order.id, {
        items: nextItems,
        updated_at: order.updated_at,
        void_reason: reason,
        void_reason_detail: detail || undefined,
      });

      if (result.ok) {
        setPendingVoid(null);
        await refreshKitchenBoard();
        return;
      }

      const reasonMessage = voidItemReasonErrorMessage(lang, result.error);
      if (reasonMessage) {
        setVoidReasonError(reasonMessage);
        return;
      }
      if (result.status === 409) {
        setUpdateConflict(true);
        await refreshKitchenBoard();
        return;
      }

      throw new Error('kitchen_update_failed');
    } finally {
      setVoidingItem(false);
    }
  };

  useRestaurantStaffEntryReconcile(
    !isDemo,
    refreshKitchenBoard,
    undefined,
    !hasAuthoritativeSeed,
  );

  useRestaurantRealtimeRefresh(
    supabase,
    restaurant.id,
    `kitchen-${restaurant.id}`,
    !isDemo,
    refreshKitchenBoard,
  );

  return (
    <div className="flex min-h-screen flex-col bg-brand-bg">
      <StaffPersonalTopBar
        logoHref={isDemo ? '/demo/kitchen' : staffRolePath(restaurant.slug, 'kitchen')}
        restaurantName={restaurant.name}
        roleLabel={roleLabel}
        navItems={[]}
        settingsMenu={
          <StaffPersonalSettingsMenu
            logoutLabel={exitLabel}
            onSignOut={() => void handleSignOut()}
            confirmSignOut={confirmBeforeSignOut}
            compact
          />
        }
      />
      <div className="min-h-0 flex-1 overflow-x-clip p-4">
      {isDemo && (
        <div className="mb-4 rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3">
          <p className="text-[13px] text-brand-text">
            {demoText.step}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/demo/menu"
              className="text-[13px] rounded-lg border border-brand-border px-3 py-1.5 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {demoText.openCustomer}
            </Link>
            <Link
              href="/demo/waiter"
              className="text-[13px] rounded-lg border border-brand-border px-3 py-1.5 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {demoText.openWaiter}
            </Link>
            <Link
              href="/demo"
              className="text-[13px] rounded-lg border border-brand-border px-3 py-1.5 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {demoText.backHub}
            </Link>
          </div>
        </div>
      )}
      {/* 标题栏 */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-brand-gold">
          {isDemo ? demoText.title : t.display}
        </h1>
        <p className="text-brand-text-muted text-sm mt-1">
          {boardOrders.length} {t.pendingCount}
        </p>
        {idleTableCount > 0 && (
          <p className="text-brand-text-muted text-[13px] mt-0.5">
            {t.openTablesIdleNote.replace('{n}', String(idleTableCount))}
          </p>
        )}
      </div>
      {updateConflict && (
        <div className="mb-4 mesa-alert-warning px-4 py-2 text-sm">
          {demoText.conflict}
        </div>
      )}

      {/* 待处理订单 + 在席占位 */}
      {kitchenColumns.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">✅</p>
          <p className="text-brand-text-muted text-lg">{t.allDone}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {kitchenColumns.map((col) =>
            col.kind === 'order' ? (
              <OrderCard
                key={col.order.id}
                order={col.order}
                onItemStatusChange={updateItemStatus}
                labels={t}
                locale={locale}
              />
            ) : (
              <OpenTablePlaceholder key={`open-${col.tableId}`} table={col.displayName} labels={t} />
            ),
          )}
        </div>
      )}

      <VoidItemReasonDialog
        open={pendingVoid != null}
        onClose={() => {
          setPendingVoid(null);
          setVoidReasonError(null);
        }}
        lang={lang}
        item={pendingVoid ? pendingVoid.order.items[pendingVoid.itemIdx] ?? null : null}
        confirming={voidingItem}
        externalError={voidReasonError}
        onConfirm={performKitchenVoid}
      />
      </div>
    </div>
  );
}

function OpenTablePlaceholder({
  table,
  labels,
}: {
  table: string;
  labels: { table: string; openTableBadge: string; openTableIdle: string };
}) {
  return (
    <div className="border-2 border-dashed border-sky-500/35 rounded-2xl p-4 bg-sky-500/6">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="font-heading text-2xl text-brand-text">
          {labels.table} {table}
        </span>
        <span className="text-[13px] px-2 py-1 rounded-full bg-sky-500/14 border border-sky-500/35 text-sky-800 whitespace-nowrap">
          {labels.openTableBadge}
        </span>
      </div>
      <p className="text-brand-text-muted text-sm leading-relaxed">{labels.openTableIdle}</p>
    </div>
  );
}

// 订单卡片
function OrderCard({
  order,
  onItemStatusChange,
  labels,
  locale,
}: {
  order: Order;
  onItemStatusChange: (order: Order, itemIdx: number, status: OrderItemStatus) => Promise<void>;
  labels: {
    table: string;
    newOrder: string;
    cooking: string;
    completed: string;
    startCooking: string;
    finishServing: string;
    voidItem: string;
    voided: string;
    firstBatch: string;
    addOnBatch: string;
  };
  locale: string;
}) {
  const [updating, setUpdating] = useState(false);

  const handleItemStatusChange = async (itemIdx: number, status: OrderItemStatus) => {
    setUpdating(true);
    await onItemStatusChange(order, itemIdx, status);
    setUpdating(false);
  };

  const time = new Date(order.created_at);
  const timeStr = time.toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusStyle = {
    pending: 'border-red-500/45 bg-red-500/8',
    cooking: 'border-amber-500/45 bg-amber-500/10',
    done: 'border-emerald-500/45 bg-emerald-500/10',
  };
  const kitchenLines = order.items.filter((item) => !isBuffetBaseItem(item));
  if (kitchenLines.length === 0) return null;

  const allVoided = itemsEveryVoided(kitchenLines);
  const batchOrder: string[] = [];
  kitchenLines.forEach((item) => {
    const batch = orderItemBatchKey(item);
    if (!batchOrder.includes(batch)) batchOrder.push(batch);
  });

  return (
    <div
      className={`border-2 rounded-2xl p-4 ${
        allVoided ? 'border-slate-500/40 bg-slate-500/10' : statusStyle[order.status]
      }`}
    >
      {/* 卡片头部 */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-heading text-2xl text-brand-text">{labels.table} {order.display_name}</span>
          <p className="text-brand-text-muted text-[13px]">{timeStr}</p>
        </div>
        <span
          className={`text-[13px] px-2 py-1 rounded-full font-medium ${
            allVoided
              ? 'bg-slate-500/14 border border-slate-500/35 text-slate-700'
              : order.status === 'pending'
                ? 'mesa-badge-danger'
                : order.status === 'cooking'
                  ? 'mesa-badge-warning'
                  : 'mesa-badge-success'
          }`}
        >
          {allVoided
            ? labels.voided
            : order.status === 'pending'
              ? labels.newOrder
              : order.status === 'cooking'
                ? labels.cooking
                : labels.completed}
        </span>
      </div>

      {/* 菜品列表（按加单批次分组） */}
      <div className="space-y-3 mb-4">
        {batchOrder.map((batchId, batchIdx) => {
          const batchItems = order.items
            .map((item, idx) => ({ item, idx }))
            .filter(
              ({ item }) =>
                !isBuffetBaseItem(item) && orderItemBatchKey(item) === batchId,
            );
          const batchLabel = batchIdx === 0 ? labels.firstBatch : `${labels.addOnBatch} #${batchIdx}`;
          const batchTime = batchItems[0]?.item.added_at
            ? new Date(batchItems[0].item.added_at as string).toLocaleString(locale, {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
            : null;

          return (
            <div key={`${order.id}-${batchId}`} className="rounded-lg border border-brand-border/60 p-2.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-brand-gold font-medium">{batchLabel}</p>
                {batchTime && <p className="text-[10px] text-brand-text-muted">{batchTime}</p>}
              </div>
              <div className="space-y-2">
                {batchItems.map(({ item, idx }) => {
                  const status = normalizeOrderItemStatus(item, order.status);
                  return (
                  <div key={`${order.id}-${idx}`} className="flex items-start gap-2">
                    <span className="text-xl flex-shrink-0">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-brand-text text-sm">
                        {(item.name || item.name_pt)}
                        <span className="text-brand-gold ml-2">× {item.qty}</span>
                      </p>
                      {item.note && (
                        <p className="text-[13px] bg-amber-500/14 border border-amber-500/30 text-brand-text px-2 py-0.5 rounded mt-1">
                          📝 {item.note}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          status === 'done'
                            ? 'mesa-badge-success'
                            : status === 'voided'
                              ? 'bg-slate-500/12 border border-slate-500/30 text-slate-700'
                            : status === 'cooking'
                              ? 'mesa-badge-warning'
                              : 'mesa-badge-danger'
                        }`}>
                          {status === 'done'
                            ? labels.completed
                            : status === 'voided'
                              ? labels.voided
                            : status === 'cooking'
                              ? labels.cooking
                              : labels.newOrder}
                        </span>
                        {status === 'pending' && (
                          <button
                            onClick={() => handleItemStatusChange(idx, 'cooking')}
                            disabled={updating}
                            className="text-[11px] mesa-badge-warning border px-2 py-0.5 rounded-md hover:bg-amber-500/28 disabled:opacity-50"
                          >
                            {labels.startCooking}
                          </button>
                        )}
                        {status === 'cooking' && (
                          <button
                            onClick={() => handleItemStatusChange(idx, 'done')}
                            disabled={updating}
                            className="text-[11px] mesa-badge-success border px-2 py-0.5 rounded-md hover:bg-emerald-500/26 disabled:opacity-50"
                          >
                            {labels.finishServing}
                          </button>
                        )}
                        {(status === 'pending' || status === 'cooking') && (
                          <button
                            onClick={() => handleItemStatusChange(idx, 'voided')}
                            disabled={updating}
                            className="text-[11px] bg-slate-500/12 text-slate-700 border border-slate-500/35 px-2 py-0.5 rounded-md hover:bg-slate-500/22 disabled:opacity-50"
                          >
                            {labels.voidItem}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
