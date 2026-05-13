'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Buffet, Order, OrderItem } from '@/types';
import { sumLineTotals } from '@/lib/cart-totals';
import { buildBuffetBaseLine, stripBuffetBaseLines, type ResolvedBuffetPriceRow } from '@/lib/buffet-order';
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
  initialBuffets?: Buffet[];
  tableNumber: number;
  isDemo?: boolean;
}

function WaiterTableDetailInner({
  restaurant,
  initialOrders,
  initialCheckoutRequestedTables = [],
  initialBuffets = [],
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
  const activeBuffets = useMemo(() => initialBuffets.filter((b) => b.is_active), [initialBuffets]);
  const [buffetId, setBuffetId] = useState<string>(() => activeBuffets[0]?.id || '');
  const [buffetAdults, setBuffetAdults] = useState(2);
  const [buffetChildren, setBuffetChildren] = useState(0);
  const [buffetSubmitting, setBuffetSubmitting] = useState(false);
  const [buffetResolved, setBuffetResolved] = useState<ResolvedBuffetPriceRow | null>(null);
  const [buffetPriceLoading, setBuffetPriceLoading] = useState(false);

  useEffect(() => {
    if (isDemo || !buffetId) {
      setBuffetResolved(null);
      setBuffetPriceLoading(false);
      return;
    }
    let cancelled = false;
    const load = async (silent: boolean) => {
      if (!silent) setBuffetPriceLoading(true);
      const { data: priceRows, error } = await supabase.rpc('resolve_buffet_prices', {
        p_restaurant_id: restaurant.id,
        p_buffet_id: buffetId,
        p_at: new Date().toISOString(),
      });
      if (cancelled) {
        if (!silent) setBuffetPriceLoading(false);
        return;
      }
      if (!silent) setBuffetPriceLoading(false);
      if (error) {
        if (!silent) setBuffetResolved(null);
        return;
      }
      const resolvedRow = Array.isArray(priceRows) ? priceRows[0] : priceRows;
      setBuffetResolved({
        adult_price: resolvedRow?.adult_price != null ? Number(resolvedRow.adult_price) : null,
        child_price: resolvedRow?.child_price != null ? Number(resolvedRow.child_price) : null,
        rule_id: resolvedRow?.rule_id ?? null,
        time_slot_id: resolvedRow?.time_slot_id ?? null,
      });
    };
    void load(false);
    const intervalId = window.setInterval(() => {
      void load(true);
    }, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isDemo, buffetId, restaurant.id, supabase]);

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

  const selectedCard = useMemo(() => buildWaiterTableCard(tableNumber, orders), [orders, tableNumber]);

  const activeTableNumbers = useMemo(() => {
    return Array.from({ length: 30 }, (_, idx) => idx + 1).filter((table) => {
      const c = buildWaiterTableCard(table, orders);
      return (
        c.pending > 0 ||
        c.cooking > 0 ||
        c.ready > 0 ||
        c.buffetLines.length > 0 ||
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

  const applyBuffetToTable = async () => {
    if (isDemo || !buffetId) return;
    const buffet = activeBuffets.find((b) => b.id === buffetId);
    if (!buffet) return;

    setBuffetSubmitting(true);
    try {
      const { data: priceRows, error: priceError } = await supabase.rpc('resolve_buffet_prices', {
        p_restaurant_id: restaurant.id,
        p_buffet_id: buffetId,
        p_at: new Date().toISOString(),
      });
      if (priceError) {
        showToast(t.actionFailed, 'error');
        return;
      }
      const resolvedRow = Array.isArray(priceRows) ? priceRows[0] : priceRows;
      const resolved = {
        adult_price: resolvedRow?.adult_price != null ? Number(resolvedRow.adult_price) : null,
        child_price: resolvedRow?.child_price != null ? Number(resolvedRow.child_price) : null,
        rule_id: resolvedRow?.rule_id ?? null,
        time_slot_id: resolvedRow?.time_slot_id ?? null,
      };
      const line = buildBuffetBaseLine({
        buffet,
        adultCount: buffetAdults,
        childCount: buffetChildren,
        resolved,
      });
      if (!line) {
        showToast(t.buffetNoRule, 'error');
        return;
      }

      let { data: session } = await supabase
        .from('table_sessions')
        .select('id, status')
        .eq('restaurant_id', restaurant.id)
        .eq('table_number', tableNumber)
        .in('status', ['open', 'billing'])
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!session?.id) {
        const { data: createdSession, error: csErr } = await supabase
          .from('table_sessions')
          .insert({
            restaurant_id: restaurant.id,
            table_number: tableNumber,
            status: 'open',
          })
          .select('id, status')
          .single();
        if (csErr || !createdSession) {
          showToast(t.buffetNeedOpen, 'error');
          return;
        }
        session = createdSession;
      }

      if (session.status === 'billing') {
        showToast(t.buffetBilling, 'error');
        return;
      }

      const sessionId = session.id as string;

      const { data: openOrder } = await supabase
        .from('orders')
        .select('id, items, updated_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const mergedItems: OrderItem[] = [
        ...stripBuffetBaseLines((openOrder?.items || []) as OrderItem[]),
        line,
      ];
      const total = sumLineTotals(mergedItems);
      const nextStatus = deriveOrderStatusFromItems(mergedItems);

      if (openOrder?.id) {
        const { error: updErr } = await supabase
          .from('orders')
          .update({
            items: mergedItems,
            total_amount: total,
            status: nextStatus,
          })
          .eq('id', openOrder.id)
          .eq('updated_at', openOrder.updated_at);
        if (updErr) {
          showToast(t.refreshHint, 'error');
          return;
        }
      } else {
        const { error: insErr } = await supabase.from('orders').insert({
          restaurant_id: restaurant.id,
          session_id: sessionId,
          table_number: tableNumber,
          status: nextStatus,
          items: mergedItems,
          total_amount: total,
        });
        if (insErr) {
          showToast(t.actionFailed, 'error');
          return;
        }
      }

      setOrders(await fetchWaiterBoardOrders(supabase, restaurant.id));
      showToast(t.actionSuccess, 'success');
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      setBuffetSubmitting(false);
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

        {activeBuffets.length > 0 && !isDemo && (
          <div className="mb-4 rounded-xl border border-brand-gold/30 bg-brand-gold/8 p-3 space-y-2">
            <p className="text-[12px] font-medium text-brand-gold">{t.buffetBlock}</p>
            {selectedCard.buffetLines.length > 0 && (
              <ul className="text-[13px] text-brand-text space-y-1">
                {selectedCard.buffetLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
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
                <p className="text-[12px] text-amber-800/95">{t.buffetNoRule}</p>
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
                <input
                  type="number"
                  min={0}
                  className="mt-0.5 block w-16 rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-sm text-brand-text"
                  value={buffetAdults}
                  onChange={(e) => setBuffetAdults(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
              <label className="text-[11px] text-brand-text-muted">
                {t.buffetChildren}
                <input
                  type="number"
                  min={0}
                  className="mt-0.5 block w-16 rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-sm text-brand-text"
                  value={buffetChildren}
                  onChange={(e) => setBuffetChildren(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
              <button
                type="button"
                onClick={() => void applyBuffetToTable()}
                disabled={buffetSubmitting}
                className="text-[12px] px-3 py-2 rounded-lg bg-brand-gold text-brand-bg font-medium disabled:opacity-50"
              >
                {buffetSubmitting ? '…' : t.buffetApply}
              </button>
            </div>
          </div>
        )}

        {selectedCard.pending +
          selectedCard.cooking +
          selectedCard.ready +
          selectedCard.voidedItems.length +
          selectedCard.voidableItems.length +
          selectedCard.buffetLines.length ===
        0 ? (
          <div className="space-y-3">
            <p className="text-brand-text-muted">{t.noOrdersOnTable}</p>
            <div>
              <Link
                href={menuHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-[12px] bg-brand-gold/18 text-brand-gold border border-brand-gold/35 px-3 py-2 rounded-lg hover:bg-brand-gold/28 transition-colors font-medium"
              >
                {t.takeOrder}
              </Link>
              <p className="text-[11px] text-brand-text-muted mt-2 max-w-md">{t.takeOrderHint}</p>
            </div>
          </div>
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
