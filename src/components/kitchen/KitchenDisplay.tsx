'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItemStatus } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { deriveOrderStatusFromItems, itemsEveryVoided, normalizeOrderItemStatus } from '@/lib/order-status';

interface Props {
  restaurant: { id: string; name: string; slug: string; kitchen_password: string };
  initialOrders: Order[];
  /** 开台 / 结账中（table_sessions open|billing）的桌号，用于无待备餐单时在厨房占位 */
  initialActiveTables?: number[];
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

// Web Audio API 生成提示音
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // 静默失败（某些浏览器需要用户交互）
  }
}

async function loadKitchenBoard(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
): Promise<{ orders: Order[]; activeTables: number[] }> {
  const [ordersRes, sessionsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'cooking'])
      .order('created_at', { ascending: true }),
    supabase
      .from('table_sessions')
      .select('id, table_number')
      .eq('restaurant_id', restaurantId)
      .in('status', ['open', 'billing']),
  ]);
  const sessions = (sessionsRes.data || []) as { id: string; table_number: number }[];
  const activeIds = new Set(sessions.map((r) => r.id));
  const rawOrders = (ordersRes.data || []) as Order[];
  const orders = rawOrders.filter((o) => !o.session_id || activeIds.has(o.session_id));
  const activeTables = Array.from(new Set(sessions.map((r) => r.table_number))).sort((a, b) => a - b);
  return { orders, activeTables };
}

export function KitchenDisplay({
  restaurant,
  initialOrders,
  initialActiveTables = [],
  isDemo = false,
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).kitchen;
  const demoText = KITCHEN_DEMO_TEXT[lang];
  const locale = UI_LOCALE_BY_LANG[lang];
  const [authenticated, setAuthenticated] = useState(isDemo);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState(false);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeTables, setActiveTables] = useState<number[]>(initialActiveTables);
  const [doneOrders, setDoneOrders] = useState<Order[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [updateConflict, setUpdateConflict] = useState(false);
  const prevOrderIds = useRef<Set<string>>(new Set(initialOrders.map(o => o.id)));
  const supabase = createClient();

  const idleTableCount = useMemo(() => {
    const busy = new Set(orders.map((o) => o.table_number));
    return activeTables.filter((t) => !busy.has(t)).length;
  }, [orders, activeTables]);

  const kitchenColumns = useMemo(() => {
    const byTable = new Map<number, Order[]>();
    orders.forEach((o) => {
      const list = byTable.get(o.table_number) || [];
      list.push(o);
      byTable.set(o.table_number, list);
    });
    byTable.forEach((list) => {
      list.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    });
    const tableNums = new Set<number>([...activeTables, ...Array.from(byTable.keys())]);
    const sortedTables = Array.from(tableNums).sort((a, b) => a - b);
    type Col = { kind: 'order'; order: Order } | { kind: 'placeholder'; table: number };
    const cols: Col[] = [];
    for (const tableNum of sortedTables) {
      const list = byTable.get(tableNum);
      if (list?.length) {
        list.forEach((order) => cols.push({ kind: 'order', order }));
      } else if (activeTables.includes(tableNum)) {
        cols.push({ kind: 'placeholder', table: tableNum });
      }
    }
    return cols;
  }, [orders, activeTables]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === restaurant.kitchen_password) {
      setAuthenticated(true);
      setPwError(false);
    } else {
      setPwError(true);
      setPassword('');
    }
  };

  // 更新菜品级状态，并同步订单总状态（pending/cooking/done）
  const updateItemStatus = async (order: Order, itemIdx: number, nextStatus: OrderItemStatus) => {
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

    const nextOrderStatus = deriveOrderStatusFromItems(nextItems);

    const { error } = await supabase
      .from('orders')
      .update({
        items: nextItems,
        status: nextOrderStatus,
      })
      .eq('id', order.id)
      .eq('updated_at', order.updated_at);

    if (!error) return;

    const isConflict =
      error.code === 'PGRST116' ||
      error.message.toLowerCase().includes('0 rows') ||
      error.message.toLowerCase().includes('not found');

    if (isConflict) {
      setUpdateConflict(true);
      const latest = await loadKitchenBoard(supabase, restaurant.id);
      setOrders(latest.orders);
      setActiveTables(latest.activeTables);
      return;
    }

    throw error;
  };

  // Supabase Realtime 订阅
  useEffect(() => {
    if (!authenticated || isDemo) return;

    // 加载已完成订单
    const refreshKitchenBoard = async () => {
      const [board, doneRes] = await Promise.all([
        loadKitchenBoard(supabase, restaurant.id),
        supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .eq('status', 'done')
          .order('updated_at', { ascending: false })
          .limit(20),
      ]);
      board.orders.forEach((o) => {
        if (!prevOrderIds.current.has(o.id)) {
          playBeep();
          prevOrderIds.current.add(o.id);
        }
      });
      setOrders(board.orders);
      setActiveTables(board.activeTables);
      setDoneOrders(doneRes.data || []);
    };

    void refreshKitchenBoard();

    const channel = supabase
      .channel(`kitchen-${restaurant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void refreshKitchenBoard();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_sessions',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void refreshKitchenBoard();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, isDemo, restaurant.id]);

  // 密码输入页
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 w-full max-w-sm">
          <div className="flex justify-end mb-3">
            <LanguageSwitcher compact />
          </div>
          <h1 className="font-heading text-3xl text-brand-gold text-center mb-2">
            {isDemo ? demoText.title : t.entrance}
          </h1>
          <p className="text-brand-text-muted text-sm text-center mb-6">{restaurant.name}</p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-brand-text-muted block mb-1.5">{t.password}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={password}
                onChange={e => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-center text-2xl tracking-widest text-brand-text focus:outline-none focus:border-brand-gold/50"
                placeholder="••••"
                autoFocus
              />
            </div>
            {pwError && (
              <p className="text-red-400 text-sm text-center">{t.wrongPassword}</p>
            )}
            <button
              type="submit"
              className="w-full bg-brand-gold text-brand-bg py-3 rounded-xl font-semibold hover:bg-brand-gold-light transition-colors"
            >
              {isDemo ? demoText.enter : t.enterKitchen}
            </button>
          </form>
          {isDemo && (
            <p className="mt-3 text-center text-[13px] text-brand-text-muted">
              {demoText.passwordHint} <span className="text-brand-gold font-semibold">0000</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // 厨房显示页
  return (
    <div className="min-h-screen bg-brand-bg p-4">
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl text-brand-gold">{restaurant.name}</h1>
          <p className="text-brand-text-muted text-sm">
            {t.display} · {orders.length} {t.pendingCount}
          </p>
          {idleTableCount > 0 && (
            <p className="text-brand-text-muted text-[13px] mt-0.5">
              {t.openTablesIdleNote.replace('{n}', String(idleTableCount))}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <button
            onClick={() => setShowDone(!showDone)}
            className="text-sm text-brand-text-muted border border-brand-border px-4 py-2 rounded-lg hover:border-brand-gold/50 transition-colors"
          >
            {showDone ? t.hideDone : `${t.doneWithCount} (${doneOrders.length})`}
          </button>
        </div>
      </div>
      {updateConflict && (
        <div className="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/12 px-4 py-2 text-sm text-brand-text">
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
              <OpenTablePlaceholder key={`open-${col.table}`} table={col.table} labels={t} />
            ),
          )}
        </div>
      )}

      {/* 已完成订单 */}
      {showDone && doneOrders.length > 0 && (
        <div className="mt-8">
          <h2 className="text-brand-text-muted text-sm font-medium mb-3 uppercase tracking-wider">
            {t.doneOrders}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {doneOrders.map(order => (
              <div
                key={order.id}
                className="bg-brand-card border border-brand-border rounded-xl p-3 opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-brand-text text-sm font-medium">{t.table} {order.table_number}</span>
                  <span className="text-[13px] bg-emerald-500/16 border border-emerald-500/35 text-brand-text px-2 py-0.5 rounded-full">{t.done}</span>
                </div>
                {order.items.map((item, idx) => (
                  <p key={idx} className="text-brand-text-muted text-[13px]">
                    {item.emoji} {(item.name || item.name_pt)} × {item.qty}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OpenTablePlaceholder({
  table,
  labels,
}: {
  table: number;
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
  const allVoided = itemsEveryVoided(order.items);
  const batchOrder: string[] = [];
  order.items.forEach((item) => {
    const batch = item.batch_id || 'legacy';
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
          <span className="font-heading text-2xl text-brand-text">{labels.table} {order.table_number}</span>
          <p className="text-brand-text-muted text-[13px]">{timeStr}</p>
        </div>
        <span
          className={`text-[13px] px-2 py-1 rounded-full font-medium ${
            allVoided
              ? 'bg-slate-500/14 border border-slate-500/35 text-slate-700'
              : order.status === 'pending'
                ? 'bg-red-500/15 border border-red-500/35 text-red-700'
                : order.status === 'cooking'
                  ? 'bg-amber-500/18 border border-amber-500/35 text-amber-800'
                  : 'bg-emerald-500/16 border border-emerald-500/35 text-emerald-800'
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
            .filter(({ item }) => (item.batch_id || 'legacy') === batchId);
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
                            ? 'bg-emerald-500/16 border border-emerald-500/35 text-emerald-800'
                            : status === 'voided'
                              ? 'bg-slate-500/12 border border-slate-500/30 text-slate-700'
                            : status === 'cooking'
                              ? 'bg-amber-500/18 border border-amber-500/35 text-amber-800'
                              : 'bg-red-500/15 border border-red-500/35 text-red-700'
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
                            className="text-[11px] bg-amber-500/18 text-amber-800 border border-amber-500/45 px-2 py-0.5 rounded-md hover:bg-amber-500/28 disabled:opacity-50"
                          >
                            {labels.startCooking}
                          </button>
                        )}
                        {status === 'cooking' && (
                          <button
                            onClick={() => handleItemStatusChange(idx, 'done')}
                            disabled={updating}
                            className="text-[11px] bg-emerald-500/16 text-emerald-800 border border-emerald-500/45 px-2 py-0.5 rounded-md hover:bg-emerald-500/26 disabled:opacity-50"
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
