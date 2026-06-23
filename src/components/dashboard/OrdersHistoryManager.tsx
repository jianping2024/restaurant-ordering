'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Order } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { DayPicker, type DateRange } from 'react-day-picker';
import { endOfMonth, format, startOfMonth, startOfToday, subDays } from 'date-fns';
import Select from 'react-select';
import type { MultiValue, StylesConfig } from 'react-select';
import 'react-day-picker/dist/style.css';
import {
  mergeTablesWithOrderHistory,
  compareRestaurantTables,
  tableIdsEqual,
  type RestaurantTableRow,
} from '@/lib/restaurant-tables';
import { showToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { interpretCloseTableSessionResponse } from '@/lib/close-table-session-ui';
import { buildOrderListDisplayChips, countOrderListItems, formatOrderListItemPrintQty, type OrderListDisplayChip } from '@/lib/order-list-display';

interface Props {
  initialOrders: Order[];
  tables?: RestaurantTableRow[];
  showCloseTable?: boolean;
  restaurantId?: string;
}

interface TableOption {
  value: string;
  label: string;
}

type ActiveSessionRow = {
  id: string;
  table_id: string;
  display_name: string;
};

const META_SEP = <span className="text-brand-text-muted/50" aria-hidden>·</span>;
const ORDER_CARD_CLASS = 'bg-brand-card border border-brand-border rounded-xl px-4 py-3';

export function OrdersHistoryManager({
  initialOrders,
  tables = [],
  showCloseTable = false,
  restaurantId,
}: Props) {
  const router = useRouter();
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;
  const tablesI18n = getMessages(lang).tables;
  const locale = UI_LOCALE_BY_LANG[lang];
  const supabase = createClient();
  const [orders, setOrders] = useState(initialOrders);
  const [closingTable, setClosingTable] = useState<string | null>(null);
  const [checkoutCloseConfirmTableId, setCheckoutCloseConfirmTableId] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionRow[]>([]);
  const [operationType, setOperationType] = useState<'transfer' | 'merge' | null>(null);
  const [sourceTableId, setSourceTableId] = useState<string | null>(null);
  const [mergeSourceTableIds, setMergeSourceTableIds] = useState<string[]>([]);
  const [targetTableId, setTargetTableId] = useState<string | null>(null);
  const [sessionOperating, setSessionOperating] = useState(false);
  const [selectedTables, setSelectedTables] = useState<TableOption[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const tableById = useMemo(
    () => new Map(tables.map((row) => [row.id, row])),
    [tables],
  );

  const loadActiveSessions = useCallback(async () => {
    if (!showCloseTable || !restaurantId) return;
    const { data: sessions } = await supabase
      .from('table_sessions')
      .select('id, table_id')
      .eq('restaurant_id', restaurantId)
      .in('status', ['open', 'billing']);

    const rows = (sessions || []) as Omit<ActiveSessionRow, 'display_name'>[];
    setActiveSessions(
      rows.map((session) => ({
        ...session,
        display_name: tableById.get(session.table_id)?.display_name ?? session.table_id.slice(0, 8),
      })),
    );
  }, [restaurantId, showCloseTable, supabase, tableById]);

  useEffect(() => {
    void loadActiveSessions();
  }, [loadActiveSessions]);

  const openSessionOperation = (type: 'transfer' | 'merge', tableId: string) => {
    setOperationType(type);
    setSourceTableId(tableId);
    setMergeSourceTableIds(type === 'merge' ? [tableId] : []);
    setTargetTableId(null);
  };

  const closeSessionOperation = () => {
    setOperationType(null);
    setSourceTableId(null);
    setMergeSourceTableIds([]);
    setTargetTableId(null);
    setSessionOperating(false);
  };

  const handleSubmitSessionOperation = async () => {
    if (!restaurantId || !operationType || !targetTableId) return;

    const selectedSources =
      operationType === 'merge'
        ? mergeSourceTableIds
        : sourceTableId
          ? [sourceTableId]
          : [];
    if (selectedSources.length === 0) {
      showToast(operationType === 'merge' ? tablesI18n.mergeAtLeastTwo : tablesI18n.sameTableError, 'error');
      return;
    }

    if (operationType === 'transfer' && tableIdsEqual(sourceTableId, targetTableId)) {
      showToast(tablesI18n.sameTableError, 'error');
      return;
    }

    setSessionOperating(true);
    try {
      const { error } =
        operationType === 'transfer'
          ? await supabase.rpc('transfer_table_session', {
              p_restaurant_id: restaurantId,
              p_from_table_id: selectedSources[0],
              p_to_table_id: targetTableId,
            })
          : await supabase.rpc('merge_multiple_table_sessions', {
              p_restaurant_id: restaurantId,
              p_source_table_ids: selectedSources,
              p_target_table_id: targetTableId,
            });

      if (error) {
        if ((error.message || '').toLowerCase().includes('active session')) {
          showToast(tablesI18n.sessionConflict, 'error');
        } else {
          showToast(tablesI18n.operationFailed, 'error');
        }
        return;
      }

      await loadActiveSessions();
      showToast(tablesI18n.operationSuccess, 'success');
      closeSessionOperation();
      router.refresh();
    } catch {
      showToast(tablesI18n.operationFailed, 'error');
    } finally {
      setSessionOperating(false);
    }
  };

  const occupiedTableIds = new Set(activeSessions.map((s) => s.table_id));
  const transferTargets = tables
    .filter(
      (row) =>
        (!sourceTableId || !tableIdsEqual(row.id, sourceTableId)) &&
        !occupiedTableIds.has(row.id),
    )
    .sort(compareRestaurantTables);
  const mergeTargets = activeSessions
    .filter((s) => !mergeSourceTableIds.includes(s.table_id))
    .map((s) => tableById.get(s.table_id))
    .filter((row): row is RestaurantTableRow => !!row)
    .sort(compareRestaurantTables);
  const sessionOperationTargets = operationType === 'transfer' ? transferTargets : mergeTargets;
  const maxMergeSourceCount = Math.max(0, activeSessions.length - 1);

  useEffect(() => {
    if (operationType !== 'merge' || !targetTableId) return;
    if (mergeSourceTableIds.includes(targetTableId)) {
      setTargetTableId(null);
    }
  }, [operationType, targetTableId, mergeSourceTableIds]);

  const tableOptions = useMemo<TableOption[]>(
    () =>
      mergeTablesWithOrderHistory(tables, orders).map((row) => ({
        value: row.id,
        label: `${i18n.table} ${row.display_name}`,
      })),
    [i18n.table, orders, tables],
  );

  const selectStyles = useMemo<StylesConfig<TableOption, true>>(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: 40,
        backgroundColor: 'rgb(var(--color-brand-bg))',
        borderColor: 'rgb(var(--color-brand-border))',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(212, 175, 55, 0.4)' : 'none',
        '&:hover': { borderColor: 'rgb(var(--color-brand-border))' },
      }),
      placeholder: (base) => ({ ...base, color: 'rgb(var(--color-brand-text-muted))', fontSize: 14 }),
      menu: (base) => ({
        ...base,
        backgroundColor: 'rgb(var(--color-brand-card))',
        border: '1px solid rgb(var(--color-brand-border))',
        zIndex: 9999,
      }),
      menuPortal: (base) => ({ ...base, zIndex: 9999 }),
      menuList: (base) => ({ ...base, paddingTop: 4, paddingBottom: 4 }),
      option: (base, state) => ({
        ...base,
        fontSize: 14,
        color: state.isFocused || state.isSelected ? 'rgb(var(--color-brand-text))' : 'rgb(var(--color-brand-text-muted))',
        backgroundColor: state.isSelected
          ? 'rgba(212, 175, 55, 0.18)'
          : state.isFocused
            ? 'rgba(255, 255, 255, 0.06)'
            : 'transparent',
      }),
      multiValue: (base) => ({
        ...base,
        backgroundColor: 'rgba(212, 175, 55, 0.16)',
        border: '1px solid rgba(212, 175, 55, 0.28)',
      }),
      multiValueLabel: (base) => ({ ...base, color: 'rgb(var(--color-brand-text))', fontSize: 13 }),
      multiValueRemove: (base) => ({
        ...base,
        color: 'rgb(var(--color-brand-text-muted))',
        ':hover': { backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgb(var(--color-brand-text))' },
      }),
      input: (base) => ({ ...base, color: 'rgb(var(--color-brand-text))' }),
      singleValue: (base) => ({ ...base, color: 'rgb(var(--color-brand-text))' }),
      indicatorSeparator: (base) => ({ ...base, backgroundColor: 'rgb(var(--color-brand-border))' }),
      dropdownIndicator: (base) => ({ ...base, color: 'rgb(var(--color-brand-text-muted))' }),
      clearIndicator: (base) => ({ ...base, color: 'rgb(var(--color-brand-text-muted))' }),
    }),
    [],
  );

  const filteredOrders = useMemo(() => {
    const selectedTableIds = new Set(selectedTables.map((item) => item.value));
    return orders.filter(order => {
      if (selectedTableIds.size > 0 && !selectedTableIds.has(order.table_id)) return false;

      if (dateRange?.from) {
        const fromTs = new Date(dateRange.from);
        fromTs.setHours(0, 0, 0, 0);
        if (new Date(order.created_at).getTime() < fromTs.getTime()) return false;
      }
      if (dateRange?.to) {
        const toTs = new Date(dateRange.to);
        toTs.setHours(23, 59, 59, 999);
        if (new Date(order.created_at).getTime() > toTs.getTime()) return false;
      } else if (dateRange?.from) {
        const toTs = new Date(dateRange.from);
        toTs.setHours(23, 59, 59, 999);
        if (new Date(order.created_at).getTime() > toTs.getTime()) return false;
      }
      return true;
    });
  }, [orders, selectedTables, dateRange]);

  const sessionTableIdById = useMemo(
    () => new Map(activeSessions.map((s) => [s.id, s.table_id])),
    [activeSessions],
  );

  const tableGroups = useMemo(() => {
    if (!showCloseTable) return null;
    const map = new Map<string, { displayName: string; tableId: string; orders: Order[] }>();
    for (const order of filteredOrders) {
      const sessionId = order.session_id;
      if (!sessionId) continue;
      const tableId = sessionTableIdById.get(sessionId) ?? order.table_id;
      const displayName = tableById.get(tableId)?.display_name ?? order.display_name;
      const entry = map.get(sessionId);
      if (entry) entry.orders.push(order);
      else map.set(sessionId, { displayName, tableId, orders: [order] });
    }
    return Array.from(map.entries()).sort(([, a], [, b]) =>
      compareRestaurantTables(
        tableById.get(a.tableId) ?? { sort_order: 0, display_name: a.displayName },
        tableById.get(b.tableId) ?? { sort_order: 0, display_name: b.displayName },
      ),
    );
  }, [filteredOrders, showCloseTable, sessionTableIdById, tableById]);

  const latestOrderTime = (sourceOrders: Order[]) =>
    new Date(
      Math.max(...sourceOrders.map((order) => new Date(order.created_at).getTime())),
    ).toLocaleString(locale);

  const rangeLabel = useMemo(() => {
    if (!dateRange?.from && !dateRange?.to) return i18n.filterDateRange;
    if (dateRange?.from && dateRange?.to) return `${format(dateRange.from, 'yyyy-MM-dd')} ~ ${format(dateRange.to, 'yyyy-MM-dd')}`;
    if (dateRange?.from) return format(dateRange.from, 'yyyy-MM-dd');
    return i18n.filterDateRange;
  }, [dateRange, i18n.filterDateRange]);

  const applyPreset = (preset: 'today' | 'last7' | 'month') => {
    const today = startOfToday();
    if (preset === 'today') {
      setDateRange({ from: today, to: today });
      return;
    }
    if (preset === 'last7') {
      setDateRange({ from: subDays(today, 6), to: today });
      return;
    }
    setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
  };

  const clearRange = () => setDateRange(undefined);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [pickerOpen]);

  const buffetGuestLabels = useMemo(
    () => ({
      adults: i18n.buffetAdultsCount,
      children: i18n.buffetChildrenCount,
    }),
    [i18n.buffetAdultsCount, i18n.buffetChildrenCount],
  );

  const handlePrintOrders = (printOrders: Order[], displayName: string) => {
    const printWindow = window.open('', '_blank', 'width=700,height=900');
    if (!printWindow) return;

    const lineItems = printOrders.flatMap((order) =>
      order.items.filter((item) => item.item_status !== 'voided'),
    );
    const rows = lineItems.map(item => `
      <tr>
        <td style="padding:6px 0;">${item.emoji} ${item.name_pt}</td>
        <td style="padding:6px 0; text-align:center;">${formatOrderListItemPrintQty(item, buffetGuestLabels)}</td>
        <td style="padding:6px 0; text-align:right;">€${(item.price * item.qty).toFixed(2)}</td>
      </tr>
    `).join('');
    const totalAmount = printOrders.reduce((sum, order) => sum + order.total_amount, 0);

    printWindow.document.write(`
      <html>
        <head><title>${i18n.printTitle}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px; color: #111;">
          <h2 style="margin-bottom: 8px;">${i18n.printTitle}</h2>
          <div style="font-size: 14px; margin-bottom: 14px;">
            <div>${i18n.table} ${displayName}</div>
            <div>${latestOrderTime(printOrders)}</div>
          </div>
          <table style="width:100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="border-bottom:1px solid #ddd;">
                <th style="text-align:left; padding:6px 0;">${i18n.printDish}</th>
                <th style="text-align:center; padding:6px 0;">${i18n.printQty}</th>
                <th style="text-align:right; padding:6px 0;">${i18n.printAmount}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="margin-top: 14px; text-align: right; font-weight: 700;">${i18n.printTotal}: €${totalAmount.toFixed(2)}</div>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCloseTable = async (closeTableId: string, confirmClose = false) => {
    if (!restaurantId) return;
    setClosingTable(closeTableId);
    try {
      const res = await fetch('/api/dashboard/close-table-session', {
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
        showToast(i18n.closeTableNoSession, 'error');
        return;
      }
      if (next.action === 'confirm_close') {
        setCheckoutCloseConfirmTableId(closeTableId);
        return;
      }
      if (next.action === 'error') {
        showToast(i18n.closeTableFailed, 'error');
        return;
      }
      showToast(i18n.closeTableSuccess, 'success');
      router.refresh();
    } catch {
      showToast(i18n.closeTableFailed, 'error');
    } finally {
      setClosingTable(null);
    }
  };

  const renderItemChips = (chips: OrderListDisplayChip[]) => {
    if (chips.length === 0) return null;
    return (
      <div className="mt-2.5 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="text-[13px] bg-brand-border px-2.5 py-1 rounded-full text-brand-text-muted"
          >
            {chip.emoji} {chip.name} {chip.quantityLabel}
            {chip.note ? <span className="text-brand-text ml-1">({chip.note})</span> : null}
          </span>
        ))}
      </div>
    );
  };

  const renderListCard = (key: string, header: ReactNode, chips: OrderListDisplayChip[]) => (
    <div key={key} className={ORDER_CARD_CLASS}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">{header}</div>
      {renderItemChips(chips)}
    </div>
  );

  const renderMetaAmount = (amount: number) => (
    <span className="text-brand-gold font-medium tabular-nums">€{amount.toFixed(2)}</span>
  );

  const renderPrintButton = (onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="text-[13px] px-2.5 py-1 rounded-lg border border-brand-border text-brand-gold hover:border-brand-gold/50 transition-colors"
    >
      {i18n.print}
    </button>
  );

  const renderTableCard = ([sessionId, group]: [string, { displayName: string; tableId: string; orders: Order[] }]) => {
    const { tableId, displayName, orders: groupOrders } = group;
    const totalAmount = groupOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const chips = buildOrderListDisplayChips(groupOrders, buffetGuestLabels);

    return renderListCard(
      sessionId,
      <>
        <span className="font-medium text-brand-text">
          {i18n.table} {displayName}
        </span>
        {groupOrders.length > 1 ? (
          <>
            {META_SEP}
            <span className="text-brand-text-muted">
              {i18n.batchesCount.replace('{n}', String(groupOrders.length))}
            </span>
          </>
        ) : null}
        {META_SEP}
        <span className="text-brand-text-muted">
          {i18n.latestOrder.replace('{time}', latestOrderTime(groupOrders))}
        </span>
        {META_SEP}
        <span className="text-brand-text-muted">
          {countOrderListItems(groupOrders)} {i18n.items}
        </span>
        {META_SEP}
        {renderMetaAmount(totalAmount)}
        {renderPrintButton(() => handlePrintOrders(groupOrders, displayName))}
        <div className="flex-1 min-w-[8px]" />
        <button
          type="button"
          onClick={() => openSessionOperation('transfer', tableId)}
          className="text-sm px-3 py-1.5 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/50 transition-colors"
        >
          {tablesI18n.transferAction}
        </button>
        <button
          type="button"
          onClick={() => openSessionOperation('merge', tableId)}
          className="text-sm px-3 py-1.5 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/50 transition-colors"
        >
          {tablesI18n.mergeAction}
        </button>
        <button
          type="button"
          disabled={closingTable === tableId}
          onClick={() => setCheckoutCloseConfirmTableId(tableId)}
          className="text-sm px-3 py-1.5 rounded-lg border border-brand-border text-brand-text hover:border-brand-gold/50 hover:text-brand-gold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {closingTable === tableId ? i18n.closeTableOperating : i18n.closeTable}
        </button>
      </>,
      chips,
    );
  };

  const renderHistoryOrderCard = (order: Order) =>
    renderListCard(
      order.id,
      <>
        <span className="font-medium text-brand-text">
          {i18n.table} {order.display_name}
        </span>
        {META_SEP}
        <span className="text-brand-text-muted">{latestOrderTime([order])}</span>
        {META_SEP}
        <span className="text-brand-text-muted">
          {countOrderListItems([order])} {i18n.items}
        </span>
        {META_SEP}
        {renderMetaAmount(order.total_amount)}
        {renderPrintButton(() => handlePrintOrders([order], order.display_name))}
      </>,
      buildOrderListDisplayChips([order], buffetGuestLabels),
    );

  return (
    <div>
      <div className="bg-brand-card border border-brand-border rounded-xl p-4 mb-4 grid gap-3 md:grid-cols-2">
        <Select<TableOption, true>
          isMulti
          options={tableOptions}
          value={selectedTables}
          onChange={(value: MultiValue<TableOption>) => setSelectedTables([...value])}
          menuPortalTarget={typeof window !== 'undefined' ? window.document.body : null}
          menuPosition="fixed"
          placeholder={i18n.filterTable}
          styles={selectStyles}
          className="w-full text-sm"
          classNamePrefix="orders-table-select"
          noOptionsMessage={() => i18n.empty}
          isClearable
          closeMenuOnSelect
        />
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPickerOpen(v => !v)}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-left text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
          >
            {rangeLabel}
          </button>
          {pickerOpen && (
            <div className="absolute z-20 mt-2 right-0 bg-brand-card border border-brand-border rounded-xl p-3 shadow-xl min-w-[300px]">
              <div className="flex items-center gap-2 mb-3">
                <button type="button" onClick={() => applyPreset('today')} className="text-[13px] px-2 py-1 rounded border border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40">{i18n.dateToday}</button>
                <button type="button" onClick={() => applyPreset('last7')} className="text-[13px] px-2 py-1 rounded border border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40">{i18n.dateLast7}</button>
                <button type="button" onClick={() => applyPreset('month')} className="text-[13px] px-2 py-1 rounded border border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40">{i18n.dateThisMonth}</button>
              </div>
              <DayPicker
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                className="orders-rdp"
              />
              <div className="mt-3 flex items-center justify-between">
                <button type="button" onClick={clearRange} className="text-[13px] text-brand-text-muted hover:text-brand-text">
                  {i18n.clearDate}
                </button>
                <button type="button" onClick={() => setPickerOpen(false)} className="text-[13px] text-brand-gold hover:underline">
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-3 text-[13px] text-brand-text-muted">
        {i18n.total} {filteredOrders.length} {i18n.records}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
          <p className="text-brand-text-muted">{i18n.empty}</p>
        </div>
      ) : tableGroups ? (
        <div className="space-y-3">
          {tableGroups.map(renderTableCard)}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(renderHistoryOrderCard)}
        </div>
      )}
      {showCloseTable && restaurantId ? (
        <Modal
          open={!!operationType}
          onClose={closeSessionOperation}
          title={operationType === 'transfer' ? tablesI18n.transferTitle : tablesI18n.mergeTitle}
          size="sm"
        >
          <p className="text-[13px] text-brand-text-muted mb-4">
            {operationType === 'transfer' ? tablesI18n.transferHint : tablesI18n.mergeHint}
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-[13px] text-brand-text-muted block mb-1.5">
                {operationType === 'merge' ? tablesI18n.sourceTables : tablesI18n.sourceTable}
              </label>
              {operationType === 'merge' ? (
                <div className="modal-scroll rounded-lg border border-brand-border bg-brand-bg p-2 max-h-40 overflow-y-auto space-y-1.5">
                  {activeSessions.map((session) => {
                    const checked = mergeSourceTableIds.includes(session.table_id);
                    const atMaxSources = !checked && mergeSourceTableIds.length >= maxMergeSourceCount;
                    return (
                      <label
                        key={session.id}
                        className={`flex items-center gap-2 text-sm ${atMaxSources ? 'text-brand-text-muted' : 'text-brand-text'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={atMaxSources}
                          onChange={(e) => {
                            const tableId = session.table_id;
                            if (!e.target.checked) {
                              setMergeSourceTableIds((prev) => prev.filter((id) => id !== tableId));
                              return;
                            }
                            setMergeSourceTableIds((prev) =>
                              [...prev, tableId].sort((a, b) => {
                                const ta = tableById.get(a);
                                const tb = tableById.get(b);
                                if (ta && tb) return compareRestaurantTables(ta, tb);
                                return a.localeCompare(b);
                              }),
                            );
                          }}
                          className="accent-brand-gold disabled:opacity-50"
                        />
                        {tablesI18n.table} {session.display_name}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-brand-text">
                  {tablesI18n.table} {tableById.get(sourceTableId ?? '')?.display_name ?? '—'}
                </p>
              )}
              {operationType === 'merge' && (
                <p className="mt-1.5 text-[13px] text-brand-text-muted">
                  {tablesI18n.selectedCount}: {mergeSourceTableIds.length}
                </p>
              )}
            </div>
            <div>
              <label className="text-[13px] text-brand-text-muted block mb-1.5">{tablesI18n.targetTable}</label>
              <select
                value={targetTableId ?? ''}
                onChange={(e) => setTargetTableId(e.target.value || null)}
                className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/40"
              >
                <option value="">--</option>
                {sessionOperationTargets.map((row) => (
                  <option key={row.id} value={row.id}>
                    {tablesI18n.table} {row.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeSessionOperation}>{getMessages(lang).menuManager.cancel}</Button>
            <Button
              onClick={() => void handleSubmitSessionOperation()}
              loading={sessionOperating}
              disabled={
                operationType === 'merge'
                  ? mergeSourceTableIds.length === 0 || !targetTableId
                  : !sourceTableId || !targetTableId
              }
            >
              {operationType === 'transfer'
                ? (sessionOperating ? tablesI18n.transferring : tablesI18n.confirmTransfer)
                : (sessionOperating ? tablesI18n.merging : tablesI18n.confirmMerge)}
            </Button>
          </div>
        </Modal>
      ) : null}
      <ConfirmModal
        open={checkoutCloseConfirmTableId != null}
        onClose={() => setCheckoutCloseConfirmTableId(null)}
        title={i18n.closeTableConfirmTitle}
        message={i18n.closeTableConfirmMessage}
        confirmLabel={i18n.closeTableConfirmButton}
        cancelLabel={i18n.closeTableCancel}
        variant="danger"
        confirming={closingTable === checkoutCloseConfirmTableId}
        onConfirm={async () => {
          if (!checkoutCloseConfirmTableId) return;
          const tableId = checkoutCloseConfirmTableId;
          setCheckoutCloseConfirmTableId(null);
          await handleCloseTable(tableId, true);
        }}
      />
    </div>
  );
}
