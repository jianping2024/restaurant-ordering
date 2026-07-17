'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { DayPicker, type DateRange } from 'react-day-picker';
import { endOfMonth, format, startOfMonth, startOfToday, subDays } from 'date-fns';
import Select from 'react-select';
import type { MultiValue, StylesConfig } from 'react-select';
import 'react-day-picker/dist/style.css';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import { ORDER_HISTORY_MAX_TOTAL, type OrderHistoryEntry } from '@/lib/order-history/types';
import { formatDateRangeFilter } from '@/lib/order-history/parse-query';
import { useDebouncedOrderHistoryFilters, useOrderHistoryFeed } from '@/lib/use-order-history-feed';
import { useStaffCheckoutBillPrint, staffBillPrintCooldownKey } from '@/lib/use-staff-checkout-bill-print';
import { OrderHistoryDetailModal } from '@/components/dashboard/OrderHistoryDetailModal';

interface Props {
  initialItems: OrderHistoryEntry[];
  initialHasMore: boolean;
  initialCappedTotal: number;
  tables?: RestaurantTableRow[];
  restaurantSlug: string;
}

interface TableOption {
  value: string;
  label: string;
}

const META_SEP = <span className="text-brand-text-muted/50" aria-hidden>·</span>;
const ORDER_CARD_CLASS =
  'bg-brand-card border border-brand-border rounded-xl px-4 py-3 text-left w-full hover:border-brand-gold/40 transition-colors';

export function OrdersHistoryManager({
  initialItems,
  initialHasMore,
  initialCappedTotal,
  tables = [],
  restaurantSlug,
}: Props) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;
  const checkoutT = getMessages(lang).checkout;
  const locale = UI_LOCALE_BY_LANG[lang];
  const { printCheckoutBill, isPrintBillBusy, cooldownSecondsLeft, isOnCooldown } =
    useStaffCheckoutBillPrint(restaurantSlug);

  const {
    entries,
    hasMore,
    cappedTotal,
    filters,
    loading,
    setFilters,
    reload,
    loadMore,
  } = useOrderHistoryFeed({
    items: initialItems,
    hasMore: initialHasMore,
    cappedTotal: initialCappedTotal,
    filters: { tableIds: [] },
  });

  const [selectedTables, setSelectedTables] = useState<TableOption[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<OrderHistoryEntry | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const tableOptions = useMemo<TableOption[]>(
    () =>
      tables.map((row) => ({
        value: row.id,
        label: `${i18n.table} ${row.display_name}`,
      })),
    [i18n.table, tables],
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

  useEffect(() => {
    const tableIds = selectedTables.map((item) => item.value);
    const { closedFrom, closedTo } = formatDateRangeFilter({
      from: dateRange?.from,
      to: dateRange?.to,
    });
    setFilters({ tableIds, closedFrom, closedTo });
  }, [dateRange, selectedTables, setFilters]);

  useDebouncedOrderHistoryFilters(filters, reload);

  const rangeLabel = useMemo(() => {
    if (!dateRange?.from && !dateRange?.to) return i18n.filterDateRange;
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, 'yyyy-MM-dd')} ~ ${format(dateRange.to, 'yyyy-MM-dd')}`;
    }
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

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (records) => {
        if (records[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '120px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading]);

  const formatClosedAt = (closedAt: string) => new Date(closedAt).toLocaleString(locale);

  const renderMetaAmount = (entry: OrderHistoryEntry) => {
    const { listAmount, listAmountKind } = entry.settlement;
    if (listAmount == null) {
      return <span className="text-brand-text-muted">—</span>;
    }
    if (listAmountKind === 'collected') {
      return (
        <span className="text-brand-gold font-medium tabular-nums">
          {i18n.listAmountCollected} €{listAmount.toFixed(2)}
        </span>
      );
    }
    return (
      <span className="text-brand-gold font-medium tabular-nums">€{listAmount.toFixed(2)}</span>
    );
  };

  const renderPrintButton = (entry: OrderHistoryEntry) => {
    const billSplit = entry.billSplit;
    const splitId = billSplit?.id ?? '';
    const billCooldownKey = splitId ? staffBillPrintCooldownKey(splitId) : '';
    const busy = splitId ? isPrintBillBusy(splitId) : false;
    const onCooldown = billCooldownKey ? isOnCooldown(billCooldownKey) : false;
    const label = !billSplit
      ? checkoutT.printBill
      : busy
        ? checkoutT.printBillOperating
        : onCooldown
          ? checkoutT.printBillCooldown.replace('{n}', String(cooldownSecondsLeft(billCooldownKey)))
          : checkoutT.printBill;

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (billSplit) void printCheckoutBill(billSplit);
        }}
        disabled={!billSplit || busy || onCooldown}
        className="text-[13px] px-2.5 py-1 rounded-lg border border-brand-border text-brand-gold hover:border-brand-gold/50 transition-colors disabled:opacity-50 disabled:hover:border-brand-border"
      >
        {label}
      </button>
    );
  };

  const renderHistoryCard = (entry: OrderHistoryEntry) => (
    <button
      key={entry.sessionId}
      type="button"
      className={ORDER_CARD_CLASS}
      onClick={() => setSelectedEntry(entry)}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        <span className="font-medium text-brand-text">
          {i18n.table} {entry.displayName}
        </span>
        {META_SEP}
        <span className="text-brand-text-muted">{formatClosedAt(entry.closedAt)}</span>
        {META_SEP}
        <span className="text-brand-text-muted">
          {entry.itemCount} {i18n.items}
        </span>
        {META_SEP}
        <span className="text-brand-text-muted">
          {i18n.openedBy} {entry.openedByName ?? '—'}
        </span>
        {META_SEP}
        {renderMetaAmount(entry)}
        {renderPrintButton(entry)}
      </div>
    </button>
  );

  const listFooter = (): ReactNode => {
    if (loading && entries.length > 0) {
      return <p className="py-3 text-center text-[13px] text-brand-text-muted">{i18n.loadingMore}</p>;
    }
    if (!hasMore && entries.length > 0) {
      return (
        <p className="py-3 text-center text-[13px] text-brand-text-muted">
          {entries.length >= cappedTotal && cappedTotal >= ORDER_HISTORY_MAX_TOTAL
            ? i18n.maxRecordsHint
            : i18n.allLoaded}
        </p>
      );
    }
    return null;
  };

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
            onClick={() => setPickerOpen((value) => !value)}
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
        {i18n.total} {cappedTotal} {i18n.records}
      </div>

      {loading && entries.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
          <p className="text-brand-text-muted">{i18n.loadingMore}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
          <p className="text-brand-text-muted">{i18n.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(renderHistoryCard)}
          <div ref={sentinelRef} className="h-1" aria-hidden />
          {listFooter()}
        </div>
      )}

      <OrderHistoryDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  );
}
