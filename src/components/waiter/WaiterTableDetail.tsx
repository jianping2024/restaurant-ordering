'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Order } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { Modal } from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';
import { deriveOrderStatusFromItems } from '@/lib/order-status';
import { WaiterAuthenticatedShell } from '@/components/waiter/WaiterAuthenticatedShell';
import { useWaiterOrders } from '@/components/waiter/useWaiterOrders';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { buildWaiterTableCard } from '@/components/waiter/waiter-table-card';
import { fetchWaiterBoardOrders } from '@/components/waiter/waiter-board-queries';

interface Props {
  restaurant: { id: string; name: string; slug: string; waiter_password: string };
  initialOrders: Order[];
  initialCheckoutRequestedTables?: number[];
  tableNumber: number;
  isDemo?: boolean;
}

function WaiterTableDetailInner({
  restaurant,
  initialOrders,
  initialCheckoutRequestedTables = [],
  tableNumber,
  isDemo = false,
  handleLock,
}: Props & { handleLock: () => void }) {
  const { lang } = useLanguage();
  const locale = UI_LOCALE_BY_LANG[lang];
  const t = WAITER_TEXT[lang];
  const { orders, setOrders, checkoutRequestedTables, supabase } = useWaiterOrders(
    restaurant.id,
    initialOrders,
    initialCheckoutRequestedTables,
    true,
    !!isDemo,
  );

  const [operationType, setOperationType] = useState<'transfer' | 'merge' | null>(null);
  const [sourceTable, setSourceTable] = useState<number | null>(null);
  const [targetTable, setTargetTable] = useState<number | null>(null);
  const [operating, setOperating] = useState(false);
  const [closingTable, setClosingTable] = useState<number | null>(null);

  const selectedCard = useMemo(() => buildWaiterTableCard(tableNumber, orders), [orders, tableNumber]);

  const activeTableNumbers = useMemo(() => {
    return Array.from({ length: 30 }, (_, idx) => idx + 1).filter((table) => {
      const c = buildWaiterTableCard(table, orders);
      return (
        c.pending > 0 ||
        c.cooking > 0 ||
        c.ready > 0 ||
        c.voidableItems.length > 0 ||
        c.voidedItems.length > 0
      );
    });
  }, [orders]);

  const targetCandidates = operationType === 'transfer'
    ? Array.from({ length: 30 }, (_, idx) => idx + 1).filter((table) => !activeTableNumbers.includes(table) || table === sourceTable)
    : activeTableNumbers.filter((table) => table !== sourceTable);

  const canCloseTableCard = selectedCard.cooking === 0 && selectedCard.ready === 0;

  const boardHref = isDemo ? '/demo/waiter' : `/${restaurant.slug}/waiter`;
  const waiterReturnPath = isDemo ? `/demo/waiter/${tableNumber}` : `/${restaurant.slug}/waiter/${tableNumber}`;
  const menuHref = isDemo
    ? `/demo/menu?table=${tableNumber}&from=waiter&return=${encodeURIComponent(waiterReturnPath)}`
    : `/${restaurant.slug}/menu?table=${tableNumber}&from=waiter&return=${encodeURIComponent(waiterReturnPath)}`;
  const billHref = `/${restaurant.slug}/bill?table=${tableNumber}&from=waiter&return=${encodeURIComponent(waiterReturnPath)}`;

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

  const closeTableFromWaiter = async (tableNum: number) => {
    setClosingTable(tableNum);
    try {
      const { data: session, error: findError } = await supabase
        .from('table_sessions')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .eq('table_number', tableNum)
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
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <Link
            href={boardHref}
            className="text-[13px] rounded-lg border border-brand-border px-3 py-1.5 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
          >
            ← {t.backToBoard}
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <button
              type="button"
              onClick={handleLock}
              className="text-[12px] px-2 py-1 rounded-md border border-brand-border text-brand-text-muted hover:text-brand-text transition-colors"
            >
              {t.lock}
            </button>
          </div>
        </div>
        <h1 className="font-heading text-3xl text-brand-gold">{restaurant.name}</h1>
        <p className="text-brand-text-muted text-sm mt-1">{t.boardTitle}</p>
      </div>

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
              <Link
                href={menuHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] bg-brand-gold/18 text-brand-gold border border-brand-gold/35 px-2 py-0.5 rounded-md hover:bg-brand-gold/28 transition-colors"
              >
                {t.addDish}
              </Link>
              {checkoutRequestedTables.includes(selectedCard.table) && (
                <Link
                  href={billHref}
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
              {canCloseTableCard && (
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
    </div>
  );
}

export function WaiterTableDetail(props: Props) {
  const { restaurant, isDemo } = props;
  return (
    <WaiterAuthenticatedShell restaurant={restaurant} isDemo={isDemo}>
      {({ handleLock }) => <WaiterTableDetailInner {...props} handleLock={handleLock} />}
    </WaiterAuthenticatedShell>
  );
}
