'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Buffet, Order, OrderItem } from '@/types';
import { sumLineTotals } from '@/lib/cart-totals';
import {
  aggregateBuffetForOrders,
  buildBuffetBaseLine,
  formatBuffetSummaryLine,
  voidActiveBuffetBaseLines,
  type ResolvedBuffetPriceRow,
} from '@/lib/buffet-order';
import { ordersForWaiterTableView } from '@/lib/waiter-table-orders';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { StaffRoleToolbar } from '@/components/staff/StaffRoleToolbar';
import { UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { Modal } from '@/components/ui/Modal';
import { IntegerInput } from '@/components/ui/IntegerInput';
import { showToast } from '@/components/ui/Toast';
import { deriveOrderStatusFromItems } from '@/lib/order-status';
import { WaiterAuthenticatedShell } from '@/components/waiter/WaiterAuthenticatedShell';
import { useWaiterOrders } from '@/components/waiter/useWaiterOrders';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { buildWaiterTableCard } from '@/components/waiter/waiter-table-card';
import { waiterUi } from '@/components/waiter/waiter-ui';
import { useBuffetPricesRealtimeRefresh } from '@/lib/use-buffet-prices-realtime-refresh';
import { tableIdsEqual, type RestaurantTableRow } from '@/lib/restaurant-tables';

interface Props {
  restaurant: { id: string; name: string; slug: string };
  tables?: RestaurantTableRow[];
  initialOrders?: Order[];
  initialCheckoutRequestedTableIds?: string[];
  initialBuffets?: Buffet[];
  tableId: string;
  displayName?: string;
  isDemo?: boolean;
}

function WaiterTableDetailInner({
  restaurant,
  tables: tablesProp = [],
  initialOrders = [],
  initialCheckoutRequestedTableIds = [],
  initialBuffets = [],
  tableId,
  displayName = '',
  isDemo = false,
  handleSignOut,
  exitLabel,
}: Props & { handleSignOut: () => void; exitLabel: string }) {
  const router = useRouter();
  const { lang } = useLanguage();
  const locale = UI_LOCALE_BY_LANG[lang];
  const t = WAITER_TEXT[lang];
  const {
    orders,
    refresh,
    supabase,
    tables,
    tablesLoaded,
    activeSessionByTableId,
  } = useWaiterOrders(
    restaurant,
    initialOrders,
    initialCheckoutRequestedTableIds,
    tablesProp,
    !isDemo,
  );

  const [operationType, setOperationType] = useState<'transfer' | 'merge' | null>(null);
  const [sourceTable, setSourceTable] = useState<string | null>(null);
  const [targetTable, setTargetTable] = useState<string | null>(null);
  const [operating, setOperating] = useState(false);
  const [closingTable, setClosingTable] = useState<string | null>(null);
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
      const resolvedRow = Array.isArray(priceRows) ? priceRows[0] : priceRows;
      setBuffetResolved({
        adult_price: resolvedRow?.adult_price != null ? Number(resolvedRow.adult_price) : null,
        child_price: resolvedRow?.child_price != null ? Number(resolvedRow.child_price) : null,
        rule_id: resolvedRow?.rule_id ?? null,
        time_slot_id: resolvedRow?.time_slot_id ?? null,
      });
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

  const configuredTables = useMemo(() => tables, [tables]);
  const selectedTable = useMemo(
    () => configuredTables.find((row) => tableIdsEqual(row.id, tableId)) || null,
    [configuredTables, tableId],
  );
  const selectedDisplayName = selectedTable?.display_name || displayName;

  const tableOrders = useMemo(
    () => ordersForWaiterTableView(tableId, orders, activeSessionByTableId),
    [tableId, orders, activeSessionByTableId],
  );

  const selectedCard = useMemo(
    () => buildWaiterTableCard(tableId, selectedDisplayName, tableOrders),
    [tableOrders, tableId, selectedDisplayName],
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

  const activeTableIds = useMemo(() => {
    return configuredTables
      .filter((table) => {
        const view = ordersForWaiterTableView(table.id, orders, activeSessionByTableId);
        const c = buildWaiterTableCard(table.id, table.display_name, view);
        return (
          c.pending > 0 ||
          c.cooking > 0 ||
          c.ready > 0 ||
          c.hasBuffet ||
          c.voidableItems.length > 0 ||
          c.voidedItems.length > 0
        );
      })
      .map((t) => t.id);
  }, [configuredTables, orders, activeSessionByTableId]);

  const targetCandidates = operationType === 'transfer'
    ? configuredTables.filter(
        (table) =>
          !activeTableIds.includes(table.id) &&
          (!sourceTable || !tableIdsEqual(table.id, sourceTable)),
      )
    : configuredTables.filter(
        (table) =>
          activeTableIds.includes(table.id) &&
          (!sourceTable || !tableIdsEqual(table.id, sourceTable)),
      );

  const sourceTableLabel =
    configuredTables.find((row) => row.id === sourceTable)?.display_name ?? sourceTable ?? '';

  const canCloseTableCard = selectedCard.cooking === 0 && selectedCard.ready === 0;

  const boardHref = isDemo ? '/demo/waiter' : `/${restaurant.slug}/waiter`;
  const waiterReturnPath = isDemo
    ? `/demo/waiter/${encodeURIComponent(tableId)}`
    : `/${restaurant.slug}/waiter/${encodeURIComponent(tableId)}`;
  const menuHref = isDemo
    ? `/demo/menu?table_id=${encodeURIComponent(tableId)}&from=waiter&return=${encodeURIComponent(waiterReturnPath)}`
    : `/${restaurant.slug}/menu?table_id=${encodeURIComponent(tableId)}&from=waiter&return=${encodeURIComponent(waiterReturnPath)}`;

  const openAction = (type: 'transfer' | 'merge', sourceId: string) => {
    setOperationType(type);
    setSourceTable(sourceId);
    setTargetTable(null);
  };

  const closeAction = () => {
    setOperationType(null);
    setSourceTable(null);
    setTargetTable(null);
    setOperating(false);
  };

  const tableDisplayName = useCallback(
    (id: string) => {
      const row =
        configuredTables.find((r) => tableIdsEqual(r.id, id)) ??
        tables.find((r) => tableIdsEqual(r.id, id));
      return row?.display_name ?? id;
    },
    [configuredTables, tables],
  );

  const goToTableDetail = useCallback(
    (targetTableId: string) => {
      const href = isDemo
        ? `/demo/waiter/${encodeURIComponent(targetTableId)}`
        : `/${restaurant.slug}/waiter/${encodeURIComponent(targetTableId)}`;
      router.replace(href);
    },
    [isDemo, restaurant.slug, router],
  );

  const finishTransferOrMerge = useCallback(
    async (targetTableId: string, operation: 'transfer' | 'merge') => {
      const board = await refresh();
      const label =
        board?.tables.find((row) => tableIdsEqual(row.id, targetTableId))?.display_name
        ?? tableDisplayName(targetTableId);
      const toastText =
        operation === 'transfer'
          ? t.transferDone.replace('{table}', label)
          : t.mergeDone.replace('{table}', label);
      closeAction();
      showToast(toastText, 'success');
      goToTableDetail(targetTableId);
    },
    [refresh, tableDisplayName, t.transferDone, t.mergeDone, goToTableDetail],
  );

  const handleActionSubmit = async () => {
    if (!operationType || !sourceTable || !targetTable) return;
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
          showToast(t.actionFailed, 'error');
          return;
        }
        await finishTransferOrMerge(toTable, currentOperation);
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

      await finishTransferOrMerge(toTable, currentOperation);
    } catch {
      showToast(t.actionFailed, 'error');
    } finally {
      setOperating(false);
    }
  };

  if (!isDemo && tablesLoaded && !selectedTable) {
    return (
      <div className="min-h-screen bg-brand-bg p-4">
        <StaffRoleToolbar exitLabel={exitLabel} onSignOut={handleSignOut} />
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

  const closeTableFromWaiter = async (closeTableId: string) => {
    setClosingTable(closeTableId);
    try {
      if (!isDemo) {
        const res = await fetch(
          `/api/restaurants/${encodeURIComponent(restaurant.slug)}/staff/waiter/sessions/close`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table_id: closeTableId }),
          },
        );
        if (res.status === 404) {
          showToast(t.closeTableNoSession, 'error');
          return;
        }
        if (!res.ok) {
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

  const applyBuffetToTable = async () => {
    if (isDemo || !buffetId) return;
    const buffet = activeBuffets.find((b) => b.id === buffetId);
    if (!buffet) return;

    setBuffetSubmitting(true);
    try {
      if (!isDemo) {
        const res = await fetch(
          `/api/restaurants/${encodeURIComponent(restaurant.slug)}/staff/waiter/buffet`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table_id: tableId,
              buffet_id: buffetId,
              adult_count: buffetAdults,
              child_count: buffetChildren,
            }),
          },
        );
        if (res.status === 400) {
          const data = await res.json().catch(() => ({}));
          if (data.error === 'no_price_rule') showToast(t.buffetNoRule, 'error');
          else if (data.error === 'session_billing') showToast(t.buffetBilling, 'error');
          else showToast(t.actionFailed, 'error');
          return;
        }
        if (!res.ok) {
          showToast(t.actionFailed, 'error');
          return;
        }
        await refresh();
        showToast(t.actionSuccess, 'success');
        return;
      }

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
        .eq('table_id', tableId)
        .in('status', ['open', 'billing'])
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!session?.id) {
        const { data: createdSession, error: csErr } = await supabase
          .from('table_sessions')
          .insert({
            restaurant_id: restaurant.id,
            table_id: tableId,
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

      const { data: sessionOrders } = await supabase
        .from('orders')
        .select('id, items, updated_at, table_id, created_at')
        .eq('session_id', sessionId)
        .in('status', ['pending', 'cooking', 'done']);

      for (const order of sessionOrders || []) {
        const prevItems = (order.items || []) as OrderItem[];
        const voidedItems = voidActiveBuffetBaseLines(prevItems);
        if (JSON.stringify(voidedItems) === JSON.stringify(prevItems)) continue;
        const voidedTotal = sumLineTotals(voidedItems);
        await supabase
          .from('orders')
          .update({ items: voidedItems, total_amount: voidedTotal })
          .eq('id', order.id);
      }

      const tableOrders = (sessionOrders || [])
        .filter((o) => tableIdsEqual(o.table_id as string, tableId))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      const openOrder = tableOrders[0] ?? null;

      const mergedItems: OrderItem[] = [
        ...voidActiveBuffetBaseLines((openOrder?.items || []) as OrderItem[]),
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
          table_id: tableId,
          display_name: displayName,
          status: nextStatus,
          items: mergedItems,
          total_amount: total,
        });
        if (insErr) {
          showToast(t.actionFailed, 'error');
          return;
        }
      }

      await refresh();
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
    <div className="min-h-screen bg-brand-bg p-4">
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
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <Link
            href={boardHref}
            className={waiterUi.navLink}
          >
            ← {t.backToBoard}
          </Link>
          <StaffRoleToolbar exitLabel={exitLabel} onSignOut={handleSignOut} className="mb-0" />
        </div>
        <h1 className="font-heading text-3xl text-brand-gold">{restaurant.name}</h1>
        <p className="text-brand-text-muted text-sm mt-1">{t.boardTitle}</p>
      </div>

      <div className="rounded-2xl p-4 border border-brand-border/50 bg-brand-card shadow-sm shadow-black/5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-2xl text-brand-text">{t.detailsTitle} - {t.table} {selectedCard.displayName}</h2>
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
                  className="mt-0.5 block w-16 rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-sm text-brand-text"
                  value={buffetAdults}
                  onChange={setBuffetAdults}
                />
              </label>
              <label className="text-[11px] text-brand-text-muted">
                {t.buffetChildren}
                <IntegerInput
                  min={0}
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

        {selectedCard.pending +
          selectedCard.cooking +
          selectedCard.ready +
          selectedCard.voidedItems.length +
          selectedCard.voidableItems.length +
          (selectedCard.hasBuffet ? 1 : 0) ===
        0 ? (
          <div className="space-y-3">
            <p className="text-brand-text-muted">{t.noOrdersOnTable}</p>
            <div>
              <Link href={menuHref} className={waiterUi.btnPrimary}>
                {t.takeOrder}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Link href={menuHref} className={`${waiterUi.btnPrimary} mr-1`}>
                + {t.addDish}
              </Link>
              <button
                type="button"
                onClick={() => openAction('transfer', selectedCard.tableId)}
                className={`${waiterUi.btnSecondary} ${waiterUi.btnWarm}`}
              >
                {t.transfer}
              </button>
              <button
                type="button"
                onClick={() => openAction('merge', selectedCard.tableId)}
                className={`${waiterUi.btnSecondary} ${waiterUi.btnGhost}`}
              >
                {t.merge}
              </button>
              {canCloseTableCard && (
                <button
                  type="button"
                  onClick={() => closeTableFromWaiter(selectedCard.tableId)}
                  disabled={closingTable === selectedCard.tableId}
                  className={`${waiterUi.btnSecondary} ${waiterUi.btnDanger} disabled:opacity-50`}
                >
                  {closingTable === selectedCard.tableId ? t.closeTableOperating : t.closeTable}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-[13px] mb-3">
              <span className={waiterUi.badgePending}>{t.pending} {selectedCard.pending}</span>
              <span className={waiterUi.badgeCooking}>{t.cooking} {selectedCard.cooking}</span>
              <span className={waiterUi.badgeReady}>{t.ready} {selectedCard.ready}</span>
            </div>

            <div className="rounded-lg border border-brand-border/60 p-2.5 space-y-2">
              <p className="text-[11px] text-brand-gold font-medium">{t.ready}</p>
              {selectedCard.readyItems.length === 0 ? (
                <p className="text-brand-text-muted text-sm">{t.noReady}</p>
              ) : (
                selectedCard.readyItems.map((line, idx) => (
                  <p key={idx} className="text-sm mesa-text-success">{line}</p>
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
                    <p className="text-sm text-brand-text truncate min-w-0 flex-1">{item.label}</p>
                    <button
                      type="button"
                      onClick={() => voidItemFromWaiter(item.orderId, item.itemIdx)}
                      className={`shrink-0 ${waiterUi.btnSecondary} ${waiterUi.btnGhost}`}
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
              className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/40"
            >
              <option value="">--</option>
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
    </div>
  );
}

export function WaiterTableDetail(props: Props) {
  const { restaurant, isDemo } = props;
  return (
    <WaiterAuthenticatedShell restaurant={restaurant} isDemo={isDemo}>
      {({ handleSignOut, exitLabel }) => (
        <WaiterTableDetailInner {...props} handleSignOut={handleSignOut} exitLabel={exitLabel} />
      )}
    </WaiterAuthenticatedShell>
  );
}
