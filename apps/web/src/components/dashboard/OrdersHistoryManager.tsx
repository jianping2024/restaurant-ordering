'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  type RestaurantTableRow,
} from '@/lib/restaurant-tables';
import {
  buildOrderListDisplayChips,
  countOrderListItems,
  orderListGuestLabelsFromLang,
  type OrderListDisplayChip,
} from '@/lib/order-list-display';
import type { OrderHistoryBillSplitRef } from '@/lib/order-history-bill-splits';
import { useStaffCheckoutBillPrint } from '@/lib/use-staff-checkout-bill-print';

interface Props {
  initialOrders: Order[];
  tables?: RestaurantTableRow[];
  pageTitle?: string;
  restaurantSlug: string;
  billSplitBySessionId: Record<string, OrderHistoryBillSplitRef>;
}

interface TableOption {
  value: string;
  label: string;
}

const META_SEP = <span className="text-brand-text-muted/50" aria-hidden>·</span>;
const ORDER_CARD_CLASS = 'bg-brand-card border border-brand-border rounded-xl px-4 py-3';

export function OrdersHistoryManager({
  initialOrders,
  tables = [],
  pageTitle,
  restaurantSlug,
  billSplitBySessionId,
}: Props) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;
  const checkoutT = getMessages(lang).checkout;
  const nav = getMessages(lang).nav;
  const locale = UI_LOCALE_BY_LANG[lang];
  const { printCheckoutBill, isPrintBillBusy, cooldownSecondsLeft, isOnCooldown } =
    useStaffCheckoutBillPrint(restaurantSlug);
  const [orders, setOrders] = useState(initialOrders);
  const [selectedTables, setSelectedTables] = useState<TableOption[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

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
    return orders.filter((order) => {
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

  const buffetGuestLabels = useMemo(() => orderListGuestLabelsFromLang(lang), [lang]);

  const billSplitForOrder = (order: Order): OrderHistoryBillSplitRef | undefined =>
    order.session_id ? billSplitBySessionId[order.session_id] : undefined;

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

  const renderPrintButton = (order: Order) => {
    const billSplit = billSplitForOrder(order);
    const splitId = billSplit?.id ?? '';
    const busy = splitId ? isPrintBillBusy(splitId) : false;
    const onCooldown = splitId ? isOnCooldown(splitId) : false;
    const label = !billSplit
      ? checkoutT.printBill
      : busy
        ? checkoutT.printBillOperating
        : onCooldown
          ? checkoutT.printBillCooldown.replace('{n}', String(cooldownSecondsLeft(splitId)))
          : checkoutT.printBill;

    return (
      <button
        type="button"
        onClick={() => {
          if (billSplit) void printCheckoutBill(billSplit);
        }}
        disabled={!billSplit || busy || onCooldown}
        className="text-[13px] px-2.5 py-1 rounded-lg border border-brand-border text-brand-gold hover:border-brand-gold/50 transition-colors disabled:opacity-50 disabled:hover:border-brand-border"
      >
        {label}
      </button>
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
        {renderPrintButton(order)}
      </>,
      buildOrderListDisplayChips([order], buffetGuestLabels),
    );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-brand-text">{pageTitle ?? nav.orders}</h1>
      </div>

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
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(renderHistoryOrderCard)}
        </div>
      )}
    </div>
  );
}
