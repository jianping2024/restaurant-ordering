'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { Modal } from '@/components/ui/Modal';
import { ToastContainer, showToast } from '@/components/ui/Toast';
import { deriveOrderStatusFromItems, normalizeOrderItemStatus } from '@/lib/order-status';

interface Props {
  restaurant: { id: string; name: string; slug: string; waiter_password: string };
  initialOrders: Order[];
  initialCheckoutRequestedTables?: number[];
  isDemo?: boolean;
}

const WAITER_TEXT = {
  zh: {
    demoTitle: '演示服务员看板',
    regularTitle: '服务员观察入口',
    passwordLabel: '访问密码（4位数字）',
    wrongPassword: '密码错误，请重试',
    enterRegular: '进入观察页',
    enterDemo: '进入演示看板',
    passwordHint: '演示密码',
    step: '第 3/3 步：服务员查看可端菜桌台和服务优先级。',
    openCustomer: '打开顾客视图',
    openKitchen: '打开后厨视图',
    backHub: '返回演示首页',
    boardTitle: '服务员出餐观察看板',
    empty: '当前没有活跃桌台',
    allTablesHint: '显示全部桌台，活跃桌台已置顶高亮。点击桌台查看订单详情。',
    inactive: '空闲',
    clickToView: '点击查看',
    detailsTitle: '桌台详情',
    noOrdersOnTable: '当前桌台暂无订单',
    tableLight: '状态灯',
    checkout: '结账',
    table: '桌',
    pending: '待做',
    cooking: '制作中',
    ready: '可端菜',
    noReady: '暂无可端菜品',
    transfer: '转台',
    merge: '并台',
    transferTitle: '服务员转台',
    mergeTitle: '服务员并台',
    sourceTable: '来源桌号',
    targetTable: '目标桌号',
    transferHint: '把来源桌的当前餐次整体迁移到目标桌。',
    mergeHint: '把来源桌并入目标桌，来源桌会话会关闭。',
    confirmTransfer: '确认转台',
    confirmMerge: '确认并台',
    operatingTransfer: '转台中...',
    operatingMerge: '并台中...',
    refreshHint: '桌台状态已变化，请刷新后重试',
    actionFailed: '操作失败，请重试',
    actionSuccess: '操作成功',
    sameTableError: '来源桌和目标桌不能相同',
    voidItem: '取消',
    voidPendingTitle: '待处理菜品',
    voidedLabel: '已取消',
    moreItems: '还有',
    itemsUnit: '道',
    closeTable: '关台',
    closeTableOperating: '关台中…',
    closeTableNoSession: '未找到开台记录，请刷新后重试',
    lock: '锁定',
  },
  en: {
    demoTitle: 'Demo waiter dashboard',
    regularTitle: 'Waiter access',
    passwordLabel: 'Access password (4 digits)',
    wrongPassword: 'Wrong password, please retry',
    enterRegular: 'Enter dashboard',
    enterDemo: 'Enter demo dashboard',
    passwordHint: 'Demo password',
    step: 'Step 3/3: waiter reviews ready-to-serve tables and priorities.',
    openCustomer: 'Open customer view',
    openKitchen: 'Open kitchen view',
    backHub: 'Back to demo hub',
    boardTitle: 'Waiter service board',
    empty: 'No active tables currently',
    allTablesHint: 'Showing all tables. Active tables are highlighted and listed first. Click a table to view details.',
    inactive: 'Idle',
    clickToView: 'Tap to view',
    detailsTitle: 'Table details',
    noOrdersOnTable: 'No orders on this table',
    tableLight: 'Status light',
    checkout: 'Checkout',
    table: 'Table',
    pending: 'Pending',
    cooking: 'Cooking',
    ready: 'Ready',
    noReady: 'No ready items yet',
    transfer: 'Transfer',
    merge: 'Merge',
    transferTitle: 'Waiter transfer table',
    mergeTitle: 'Waiter merge tables',
    sourceTable: 'Source table',
    targetTable: 'Target table',
    transferHint: 'Move the active session from source table to target table.',
    mergeHint: 'Merge source table into target table and close source session.',
    confirmTransfer: 'Confirm transfer',
    confirmMerge: 'Confirm merge',
    operatingTransfer: 'Transferring...',
    operatingMerge: 'Merging...',
    refreshHint: 'Table status changed. Please refresh and retry.',
    actionFailed: 'Operation failed, please retry',
    actionSuccess: 'Operation completed',
    sameTableError: 'Source and target tables cannot be the same',
    voidItem: 'Void',
    voidPendingTitle: 'Open items',
    voidedLabel: 'Voided',
    moreItems: 'More',
    itemsUnit: 'items',
    closeTable: 'Close table',
    closeTableOperating: 'Closing…',
    closeTableNoSession: 'No active session found. Refresh and try again.',
    lock: 'Lock',
  },
  pt: {
    demoTitle: 'Painel demo do garcom',
    regularTitle: 'Entrada do garcom',
    passwordLabel: 'Senha de acesso (4 digitos)',
    wrongPassword: 'Senha incorreta, tente novamente',
    enterRegular: 'Entrar no painel',
    enterDemo: 'Entrar no painel demo',
    passwordHint: 'Senha demo',
    step: 'Passo 3/3: o garcom verifica mesas prontas e prioridades.',
    openCustomer: 'Abrir visao do cliente',
    openKitchen: 'Abrir visao da cozinha',
    backHub: 'Voltar ao hub demo',
    boardTitle: 'Painel de servico do garcom',
    empty: 'Sem mesas ativas no momento',
    allTablesHint: 'Mostra todas as mesas. As mesas ativas ficam em destaque no topo. Clique para ver detalhes.',
    inactive: 'Livre',
    clickToView: 'Clique para ver',
    detailsTitle: 'Detalhes da mesa',
    noOrdersOnTable: 'Sem pedidos nesta mesa',
    tableLight: 'Luz de estado',
    checkout: 'Fechar conta',
    table: 'Mesa',
    pending: 'Pendente',
    cooking: 'Em preparo',
    ready: 'Pronto',
    noReady: 'Sem itens prontos no momento',
    transfer: 'Trocar mesa',
    merge: 'Unir mesas',
    transferTitle: 'Troca de mesa pelo garcom',
    mergeTitle: 'Uniao de mesas pelo garcom',
    sourceTable: 'Mesa de origem',
    targetTable: 'Mesa de destino',
    transferHint: 'Move a sessao ativa da mesa de origem para a mesa destino.',
    mergeHint: 'Une a mesa de origem na mesa destino e fecha a origem.',
    confirmTransfer: 'Confirmar troca',
    confirmMerge: 'Confirmar uniao',
    operatingTransfer: 'Transferindo...',
    operatingMerge: 'Unindo...',
    refreshHint: 'Estado das mesas mudou. Atualize e tente novamente.',
    actionFailed: 'Falha na operacao, tente novamente',
    actionSuccess: 'Operacao concluida',
    sameTableError: 'Mesa de origem e destino nao podem ser iguais',
    voidItem: 'Cancelar prato',
    voidPendingTitle: 'Itens em aberto',
    voidedLabel: 'Cancelado',
    moreItems: 'Mais',
    itemsUnit: 'itens',
    closeTable: 'Fechar mesa',
    closeTableOperating: 'A fechar…',
    closeTableNoSession: 'Sem sessao ativa. Atualize e tente novamente.',
    lock: 'Bloquear',
  },
} as const;

/** 只展示仍挂在 open/billing 餐次上的订单；关台后同批订单不再出现在看板。 */
async function fetchWaiterBoardOrders(supabase: ReturnType<typeof createClient>, restaurantId: string) {
  const [{ data: sessions }, { data: rows }] = await Promise.all([
    supabase
      .from('table_sessions')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .in('status', ['open', 'billing']),
    supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'cooking', 'done'])
      .order('updated_at', { ascending: false })
      .limit(200),
  ]);
  const activeIds = new Set((sessions || []).map((s) => s.id as string));
  const orders = (rows || []) as Order[];
  return orders.filter((o) => !o.session_id || activeIds.has(o.session_id));
}

async function fetchCheckoutRequestedTables(supabase: ReturnType<typeof createClient>, restaurantId: string) {
  const { data } = await supabase
    .from('bill_splits')
    .select('table_number')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'requested');
  return Array.from(new Set((data || []).map((row) => Number(row.table_number)).filter((n) => Number.isFinite(n))));
}

export function WaiterDisplay({
  restaurant,
  initialOrders,
  initialCheckoutRequestedTables = [],
  isDemo = false,
}: Props) {
  const WAITER_UNLOCK_TTL_MS = 8 * 60 * 60 * 1000;
  const waiterUnlockStorageKey = `mesa_waiter_unlock_${restaurant.id}`;
  const { lang } = useLanguage();
  const locale = UI_LOCALE_BY_LANG[lang];
  const t = WAITER_TEXT[lang];
  const [authenticated, setAuthenticated] = useState(isDemo);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState(false);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [checkoutRequestedTables, setCheckoutRequestedTables] = useState<number[]>(initialCheckoutRequestedTables);
  const [operationType, setOperationType] = useState<'transfer' | 'merge' | null>(null);
  const [sourceTable, setSourceTable] = useState<number | null>(null);
  const [targetTable, setTargetTable] = useState<number | null>(null);
  const [operating, setOperating] = useState(false);
  const [closingTable, setClosingTable] = useState<number | null>(null);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  /** One browser client per mount — avoids realtime effect re-subscribing every render. */
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (isDemo) return;
    const raw = window.localStorage.getItem(waiterUnlockStorageKey);
    if (!raw) return;
    const unlockedAt = Number(raw);
    if (!Number.isFinite(unlockedAt)) {
      window.localStorage.removeItem(waiterUnlockStorageKey);
      return;
    }
    if (Date.now() - unlockedAt <= WAITER_UNLOCK_TTL_MS) {
      setAuthenticated(true);
      return;
    }
    window.localStorage.removeItem(waiterUnlockStorageKey);
  }, [isDemo, waiterUnlockStorageKey]);

  const tableCards = useMemo(() => {
    const grouped = new Map<number, {
      pending: number;
      cooking: number;
      ready: number;
      readyItems: string[];
      voidedItems: string[];
      voidableItems: Array<{ orderId: string; itemIdx: number; label: string; status: 'pending' | 'cooking' }>;
      updatedAt: string;
    }>();

    orders.forEach((order) => {
      const current = grouped.get(order.table_number) || {
        pending: 0,
        cooking: 0,
        ready: 0,
        readyItems: [],
        voidedItems: [],
        voidableItems: [],
        updatedAt: order.updated_at || order.created_at,
      };

      order.items.forEach((item) => {
        const status = normalizeOrderItemStatus(item, order.status) as 'pending' | 'cooking' | 'done' | 'voided';
        if (status === 'pending') current.pending += item.qty;
        if (status === 'cooking') current.cooking += item.qty;
        if (status === 'done') {
          current.ready += item.qty;
          current.readyItems.push(`${item.emoji} ${item.name || item.name_pt} × ${item.qty}`);
        }
        if (status === 'voided') {
          current.voidedItems.push(`${item.emoji} ${item.name || item.name_pt} × ${item.qty}`);
        }
      });

      order.items.forEach((item, itemIdx) => {
        const status = normalizeOrderItemStatus(item, order.status) as 'pending' | 'cooking' | 'done' | 'voided';
        if (status === 'pending' || status === 'cooking') {
          current.voidableItems.push({
            orderId: order.id,
            itemIdx,
            status,
            label: `${item.emoji} ${item.name || item.name_pt} × ${item.qty}`,
          });
        }
      });

      if ((order.updated_at || order.created_at) > current.updatedAt) {
        current.updatedAt = order.updated_at || order.created_at;
      }

      grouped.set(order.table_number, current);
    });

    return Array.from(grouped.entries())
      .map(([table, data]) => ({ table, ...data }))
      .filter((card) =>
        card.pending > 0 ||
        card.cooking > 0 ||
        card.ready > 0 ||
        card.voidableItems.length > 0 ||
        card.voidedItems.length > 0,
      )
      .sort((a, b) => a.table - b.table);
  }, [orders]);

  const allTableCards = useMemo(() => {
    const activeMap = new Map(tableCards.map((card) => [card.table, card] as const));
    return Array.from({ length: 30 }, (_, idx) => idx + 1)
      .map((table) => {
        const active = activeMap.get(table);
        return active || {
          table,
          pending: 0,
          cooking: 0,
          ready: 0,
          readyItems: [] as string[],
          voidedItems: [] as string[],
          voidableItems: [] as Array<{ orderId: string; itemIdx: number; label: string; status: 'pending' | 'cooking' }>,
          updatedAt: '',
        };
      })
      .sort((a, b) => {
        const aActive = a.pending + a.cooking + a.ready + a.voidableItems.length + a.voidedItems.length > 0 ? 1 : 0;
        const bActive = b.pending + b.cooking + b.ready + b.voidableItems.length + b.voidedItems.length > 0 ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return a.table - b.table;
      });
  }, [tableCards]);

  const selectedCard = useMemo(() => {
    if (selectedTable == null) return null;
    return allTableCards.find((card) => card.table === selectedTable) || null;
  }, [allTableCards, selectedTable]);

  useEffect(() => {
    if (selectedTable != null) return;
    const firstActive = allTableCards.find((card) => card.pending + card.cooking + card.ready > 0);
    setSelectedTable(firstActive?.table || 1);
  }, [allTableCards, selectedTable]);

  useEffect(() => {
    if (!authenticated || isDemo) return;

    const refresh = async () => {
      const [nextOrders, nextCheckoutRequestedTables] = await Promise.all([
        fetchWaiterBoardOrders(supabase, restaurant.id),
        fetchCheckoutRequestedTables(supabase, restaurant.id),
      ]);
      setOrders(nextOrders);
      setCheckoutRequestedTables(nextCheckoutRequestedTables);
    };

    void refresh();

    const channel = supabase
      .channel(`waiter-${restaurant.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, () => {
        void refresh();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'table_sessions',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, () => {
        void refresh();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bill_splits',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, () => {
        void refresh();
      })
      .subscribe();

    // Realtime may occasionally miss updates in unstable networks.
    // Polling keeps waiter board eventually consistent without manual refresh.
    const pollTimer = window.setInterval(() => {
      void refresh();
    }, 5000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authenticated, isDemo, restaurant.id, supabase]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === restaurant.waiter_password) {
      setAuthenticated(true);
      setPwError(false);
      if (!isDemo) window.localStorage.setItem(waiterUnlockStorageKey, String(Date.now()));
    } else {
      setPwError(true);
      setPassword('');
    }
  };

  const handleLock = () => {
    if (!isDemo) window.localStorage.removeItem(waiterUnlockStorageKey);
    setAuthenticated(false);
    setPassword('');
  };

  const openAction = (type: 'transfer' | 'merge', table: number) => {
    setOperationType(type);
    setSourceTable(table);
    setTargetTable(null);
  };

  const closeAction = () => {
    setOperationType(null);
    setSourceTable(null);
    setTargetTable(null);
    setOperating(false);
  };

  const handleActionSubmit = async () => {
    if (!operationType || !sourceTable || !targetTable) return;
    if (sourceTable === targetTable) {
      showToast(t.sameTableError, 'error');
      return;
    }

    const currentOperation = operationType;
    const fromTable = sourceTable;
    const toTable = targetTable;
    setOperating(true);
    try {
      const { data: rpcResult, error } = currentOperation === 'transfer'
        ? await supabase.rpc('transfer_table_session', {
          p_restaurant_id: restaurant.id,
          p_from_table: fromTable,
          p_to_table: toTable,
        })
        : await supabase.rpc('merge_table_sessions', {
          p_restaurant_id: restaurant.id,
          p_source_table: fromTable,
          p_target_table: toTable,
        });

      if (error) {
        if ((error.message || '').toLowerCase().includes('active session')) {
          showToast(t.refreshHint, 'error');
        } else {
          showToast(t.actionFailed, 'error');
        }
        return;
      }

      const [sessionCheck, nextOrders] = await Promise.all([
        supabase
          .from('table_sessions')
          .select('id, table_number, status')
          .eq('id', rpcResult as string)
          .in('status', ['open', 'billing'])
          .maybeSingle(),
        fetchWaiterBoardOrders(supabase, restaurant.id),
      ]);

      if (sessionCheck.error || !sessionCheck.data || sessionCheck.data.table_number !== toTable) {
        showToast(t.refreshHint, 'error');
        return;
      }

      setOrders(nextOrders);
      closeAction();
      showToast(t.actionSuccess, 'success');
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      setOperating(false);
    }
  };

  const allTables = Array.from(new Set(tableCards.map((card) => card.table))).sort((a, b) => a - b);
  const targetCandidates = operationType === 'transfer'
    ? Array.from({ length: 30 }, (_, idx) => idx + 1).filter((table) => !allTables.includes(table) || table === sourceTable)
    : allTables.filter((table) => table !== sourceTable);

  /** 未开始备餐（无制作中、无可端菜）即可关台：含仅待做、仅已取消或混合。 */
  const canCloseTableCard = (card: (typeof tableCards)[number]) =>
    card.cooking === 0 && card.ready === 0;

  const closeTableFromWaiter = async (tableNumber: number) => {
    setClosingTable(tableNumber);
    try {
      const { data: session, error: findError } = await supabase
        .from('table_sessions')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .eq('table_number', tableNumber)
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

      setOrders(await fetchWaiterBoardOrders(supabase, restaurant.id));
      showToast(t.actionSuccess, 'success');
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      setClosingTable(null);
    }
  };

  const voidItemFromWaiter = async (orderId: string, itemIdx: number) => {
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

      setOrders(await fetchWaiterBoardOrders(supabase, restaurant.id));
      showToast(t.voidedLabel, 'success');
    } catch {
      showToast(t.actionFailed, 'error');
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 w-full max-w-sm">
          <div className="flex justify-end mb-3">
            <LanguageSwitcher compact />
          </div>
          <h1 className="font-heading text-3xl text-brand-gold text-center mb-2">{isDemo ? t.demoTitle : t.regularTitle}</h1>
          <p className="text-brand-text-muted text-sm text-center mb-6">{restaurant.name}</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-brand-text-muted block mb-1.5">{t.passwordLabel}</label>
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
            {pwError && <p className="text-red-400 text-sm text-center">{t.wrongPassword}</p>}
            <button
              type="submit"
              className="w-full bg-brand-gold text-brand-bg py-3 rounded-xl font-semibold hover:bg-brand-gold-light transition-colors"
            >
              {isDemo ? t.enterDemo : t.enterRegular}
            </button>
          </form>
          {isDemo && (
            <p className="mt-3 text-center text-[13px] text-brand-text-muted">
              {t.passwordHint} <span className="text-brand-gold font-semibold">0000</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg p-4">
      {isDemo && (
        <div className="mb-4 rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3">
          <p className="text-[13px] text-brand-text">
            {t.step}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/demo/menu"
              className="text-[13px] rounded-lg border border-brand-border px-3 py-1.5 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {t.openCustomer}
            </Link>
            <Link
              href="/demo/kitchen"
              className="text-[13px] rounded-lg border border-brand-border px-3 py-1.5 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {t.openKitchen}
            </Link>
            <Link
              href="/demo"
              className="text-[13px] rounded-lg border border-brand-border px-3 py-1.5 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {t.backHub}
            </Link>
          </div>
        </div>
      )}
      <div className="mb-6">
        <div className="flex justify-end items-center gap-2 mb-3">
          <LanguageSwitcher compact />
          <button
            type="button"
            onClick={handleLock}
            className="text-[12px] px-2 py-1 rounded-md border border-brand-border text-brand-text-muted hover:text-brand-text transition-colors"
          >
            {t.lock}
          </button>
        </div>
        <h1 className="font-heading text-3xl text-brand-gold">{restaurant.name}</h1>
        <p className="text-brand-text-muted text-sm mt-1">{t.boardTitle}</p>
      </div>

      <div className="bg-brand-card border border-brand-border rounded-2xl p-3 mb-4 text-sm text-brand-text-muted">
        {t.allTablesHint}
      </div>

      {tableCards.length === 0 && (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-4 mb-4 text-center text-brand-text-muted">
          {t.empty}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-4">
        {allTableCards.map((card) => {
          const isActive = card.pending + card.cooking + card.ready + card.voidableItems.length + card.voidedItems.length > 0;
          const isSelected = selectedTable === card.table;
          return (
            <button
              key={card.table}
              type="button"
              onClick={() => setSelectedTable(card.table)}
              className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                isSelected
                  ? 'border-brand-gold bg-brand-gold/22 ring-1 ring-brand-gold/45 shadow-[0_0_0_1px_rgba(212,175,55,0.28)]'
                  : isActive
                    ? 'border-emerald-500/45 bg-emerald-500/10'
                    : 'border-brand-border bg-brand-card'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-brand-text">{t.table} {card.table}</p>
                <div className="flex items-center gap-1.5">
                  <span
                    title={t.tableLight}
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.85)]' : 'bg-brand-text-muted/55'}`}
                  />
                  {!isActive && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-brand-border text-brand-text-muted">
                      {t.inactive}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[12px] text-brand-text-muted mt-1">{t.clickToView}</p>
            </button>
          );
        })}
      </div>

      {selectedCard && (
        <div className="border-2 rounded-2xl p-4 border-brand-border bg-brand-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-2xl text-brand-text">{t.detailsTitle} - {t.table} {selectedCard.table}</h2>
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

          {selectedCard.pending + selectedCard.cooking + selectedCard.ready + selectedCard.voidedItems.length + selectedCard.voidableItems.length === 0 ? (
            <p className="text-brand-text-muted">{t.noOrdersOnTable}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {checkoutRequestedTables.includes(selectedCard.table) && (
                  <Link
                    href={`/${restaurant.slug}/bill?table=${selectedCard.table}&from=waiter&return=/${restaurant.slug}/waiter`}
                    className="text-[11px] px-2 py-0.5 rounded-md border transition-colors bg-brand-gold/18 text-brand-gold border-brand-gold/35 hover:bg-brand-gold/28"
                  >
                    {t.checkout}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => openAction('transfer', selectedCard.table)}
                  className="text-[11px] bg-amber-500/18 text-amber-800 border border-amber-500/45 px-2 py-0.5 rounded-md hover:bg-amber-500/28 transition-colors"
                >
                  {t.transfer}
                </button>
                <button
                  type="button"
                  onClick={() => openAction('merge', selectedCard.table)}
                  className="text-[11px] bg-slate-500/12 text-slate-700 border border-slate-500/35 px-2 py-0.5 rounded-md hover:bg-slate-500/22 transition-colors"
                >
                  {t.merge}
                </button>
                {canCloseTableCard(selectedCard) && (
                  <button
                    type="button"
                    onClick={() => closeTableFromWaiter(selectedCard.table)}
                    disabled={closingTable === selectedCard.table}
                    className="text-[11px] bg-rose-500/14 text-rose-800 border border-rose-500/40 px-2 py-0.5 rounded-md hover:bg-rose-500/24 transition-colors disabled:opacity-50"
                  >
                    {closingTable === selectedCard.table ? t.closeTableOperating : t.closeTable}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-[13px] mb-3">
                <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/35 text-red-700">{t.pending} {selectedCard.pending}</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/18 border border-amber-500/35 text-amber-800">{t.cooking} {selectedCard.cooking}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/16 border border-emerald-500/35 text-emerald-800">{t.ready} {selectedCard.ready}</span>
              </div>

              <div className="rounded-lg border border-brand-border/60 p-2.5 space-y-2">
                <p className="text-[11px] text-brand-gold font-medium">{t.ready}</p>
                {selectedCard.readyItems.length === 0 ? (
                  <p className="text-brand-text-muted text-sm">{t.noReady}</p>
                ) : (
                  selectedCard.readyItems.map((line, idx) => (
                    <p key={idx} className="text-sm text-emerald-800">{line}</p>
                  ))
                )}
              </div>
              {selectedCard.voidedItems.length > 0 && (
                <div className="mt-3 rounded-lg border border-slate-500/35 p-2.5 space-y-2">
                  <p className="text-[11px] text-slate-600 font-medium">{t.voidedLabel}</p>
                  {selectedCard.voidedItems.map((line, idx) => (
                    <p key={idx} className="text-sm text-slate-600 line-through opacity-90">{line}</p>
                  ))}
                </div>
              )}
              {selectedCard.voidableItems.length > 0 && (
                <div className="mt-3 rounded-lg border border-brand-border/60 p-2.5 space-y-2">
                  <p className="text-[11px] text-brand-gold font-medium">{t.voidPendingTitle}</p>
                  {selectedCard.voidableItems.map((item) => (
                    <div key={`${item.orderId}-${item.itemIdx}`} className="flex items-center justify-between gap-2">
                      <p className="text-sm text-brand-text truncate">{item.label}</p>
                      <button
                        type="button"
                        onClick={() => voidItemFromWaiter(item.orderId, item.itemIdx)}
                        className="text-[11px] bg-slate-500/12 text-slate-700 border border-slate-500/35 px-2 py-0.5 rounded-md hover:bg-slate-500/22 transition-colors"
                      >
                        {t.voidItem}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
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
              value={sourceTable ?? ''}
              disabled
              className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 text-sm text-brand-text"
            />
          </div>
          <div>
            <label className="text-[13px] text-brand-text-muted block mb-1.5">{t.targetTable}</label>
            <select
              value={targetTable ?? ''}
              onChange={(e) => setTargetTable(Number(e.target.value) || null)}
              className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/40"
            >
              <option value="">--</option>
              {targetCandidates.map((table) => (
                <option key={table} value={table}>
                  {t.table} {table}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={closeAction}
            className="px-3 py-2 rounded-lg border border-brand-border text-sm text-brand-text-muted hover:text-brand-text transition-colors"
          >
            {lang === 'zh' ? '取消' : lang === 'en' ? 'Cancel' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={handleActionSubmit}
            disabled={!sourceTable || !targetTable || operating}
            className="px-3 py-2 rounded-lg text-sm bg-brand-gold text-brand-bg font-medium disabled:opacity-50"
          >
            {operationType === 'transfer'
              ? (operating ? t.operatingTransfer : t.confirmTransfer)
              : (operating ? t.operatingMerge : t.confirmMerge)}
          </button>
        </div>
      </Modal>
      <ToastContainer />
    </div>
  );
}
