'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { DayPicker, type DateRange } from 'react-day-picker';
import { endOfMonth, format, startOfMonth, startOfToday } from 'date-fns';
import Select from 'react-select';
import type { MultiValue, StylesConfig } from 'react-select';
import 'react-day-picker/dist/style.css';
import '@mesa/ui/date-picker.css';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import type { OrderHistoryEntry } from '@/lib/order-history/types';
import {
  defaultOrderHistoryClosedRange,
  formatOrderHistoryDateKey,
  formatOrderHistoryPickerFilter,
  orderHistoryClosedRangeToPicker,
  ORDER_HISTORY_MAX_RANGE_DAYS,
} from '@/lib/order-history/date-range';
import { useOrderHistoryFeed } from '@/lib/use-order-history-feed';
import { formatForcedUnpaidCloseAnnotation } from '@/lib/order-history/resolve-close-annotation-label';
import {
  ORDER_HISTORY_FORCED_SUMMARY_CLASS,
  buildOrderHistorySurfaceMeta,
} from '@/lib/order-history/build-lifecycle-presentation';
import {
  OrderHistoryLifecycleSteps,
  OrderHistoryOutcomeBadge,
} from '@/components/dashboard/OrderHistoryLifecycleSteps';
import { resolveBillPrintButtonLabel } from '@/lib/order-history/order-history-print-labels';
import {
  useStaffCheckoutBillPrint,
  staffBillPrintCooldownKey,
  staffSessionBillCooldownKey,
} from '@/lib/use-staff-checkout-bill-print';
import { OrderHistoryDetailModal } from '@/components/dashboard/OrderHistoryDetailModal';
import { showToast } from '@/components/ui/Toast';
import { ListPaginationBar } from '@/components/ui/ListPaginationBar';
import { isOperationalSourceCloseKind } from '@/lib/order-history/close-kind';
import { daysBetweenInclusive } from '@/lib/lisbon-calendar';
import { LIST_DEFAULT_PAGE_SIZE, type ListPageSize } from '@/lib/paginate-list';

interface Props {
  initialItems: OrderHistoryEntry[];
  initialTotal: number;
  initialItemCodeByMenuId?: Record<string, string>;
  initialClosedFrom: string;
  initialClosedTo: string;
  tables?: RestaurantTableRow[];
  restaurantSlug: string;
}

interface TableOption {
  value: string;
  label: string;
}

const META_SEP = <span className="text-brand-text-muted/50" aria-hidden>·</span>;

export function OrdersHistoryManager({
  initialItems,
  initialTotal,
  initialItemCodeByMenuId = {},
  initialClosedFrom,
  initialClosedTo,
  tables = [],
  restaurantSlug,
}: Props) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;
  const checkoutT = getMessages(lang).checkout;
  const {
    printCheckoutBill,
    printSessionCheckoutBill,
    isPrintBillBusy,
    isPrintSessionBillBusy,
    cooldownSecondsLeft,
    isOnCooldown,
  } = useStaffCheckoutBillPrint(restaurantSlug);

  const initialPickerRange = useMemo(
    () =>
      orderHistoryClosedRangeToPicker({
        closedFrom: initialClosedFrom,
        closedTo: initialClosedTo,
      }),
    [initialClosedFrom, initialClosedTo],
  );

  const {
    entries,
    total,
    itemCodeByMenuId,
    page,
    pageSize,
    loading,
    setFilters,
    goToPage,
    changePageSize,
  } = useOrderHistoryFeed({
    items: initialItems,
    total: initialTotal,
    itemCodeByMenuId: initialItemCodeByMenuId,
    filters: {
      tableIds: [],
      closedFrom: initialClosedFrom,
      closedTo: initialClosedTo,
    },
    page: 1,
    pageSize: LIST_DEFAULT_PAGE_SIZE,
  });

  const [selectedTables, setSelectedTables] = useState<TableOption[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialPickerRange);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<OrderHistoryEntry | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
    const closed = formatOrderHistoryPickerFilter({
      from: dateRange?.from,
      to: dateRange?.to,
    });
    if (!closed) {
      const fallback = defaultOrderHistoryClosedRange();
      setDateRange(orderHistoryClosedRangeToPicker(fallback));
      setFilters({ tableIds, ...fallback });
      return;
    }
    setFilters({ tableIds, ...closed });
  }, [dateRange, selectedTables, setFilters]);

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
      setDateRange(orderHistoryClosedRangeToPicker(defaultOrderHistoryClosedRange()));
      return;
    }
    setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
  };

  const resetRange = () => {
    setDateRange(orderHistoryClosedRangeToPicker(defaultOrderHistoryClosedRange()));
  };

  const onPickerSelect = (next: DateRange | undefined) => {
    if (!next?.from) {
      resetRange();
      return;
    }
    const fromKey = formatOrderHistoryDateKey(next.from);
    const toKey = formatOrderHistoryDateKey(next.to ?? next.from);
    if (daysBetweenInclusive(fromKey, toKey) > ORDER_HISTORY_MAX_RANGE_DAYS) {
      showToast(i18n.dateRangeTooLong, 'error');
    }
    const closed = formatOrderHistoryPickerFilter(next);
    if (!closed) {
      resetRange();
      return;
    }
    setDateRange(orderHistoryClosedRangeToPicker(closed));
  };

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
    const billCooldownKey = splitId
      ? staffBillPrintCooldownKey(splitId)
      : staffSessionBillCooldownKey(entry.sessionId);
    const busy = splitId
      ? isPrintBillBusy(splitId)
      : isPrintSessionBillBusy(entry.sessionId);
    const onCooldown = isOnCooldown(billCooldownKey);
    const canPrint = entry.settlement.canPrintBill;
    const label = resolveBillPrintButtonLabel(
      checkoutT,
      busy,
      onCooldown ? cooldownSecondsLeft(billCooldownKey) : 0,
    );

    if (!canPrint) return null;

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (billSplit) {
            void printCheckoutBill(billSplit);
            return;
          }
          void printSessionCheckoutBill(entry.tableId, entry.sessionId);
        }}
        disabled={busy || onCooldown}
        className="text-[13px] px-2.5 py-1 rounded-lg border border-brand-border text-brand-gold hover:border-brand-gold/50 transition-colors disabled:opacity-50 disabled:hover:border-brand-border"
      >
        {label}
      </button>
    );
  };

  const renderHistoryCard = (entry: OrderHistoryEntry) => {
    const isForcedUnpaidClose = entry.closeAnnotation.isForcedUnpaidClose;
    const forcedCloseSummary = isForcedUnpaidClose
      ? formatForcedUnpaidCloseAnnotation(lang, entry.closeAnnotation)?.summary ?? null
      : null;
    const { outcomeBadge, lifecycleSteps, cardClass, mergeSummaryLine } =
      buildOrderHistorySurfaceMeta(entry, i18n);
    const isOperationalSource = isOperationalSourceCloseKind(entry.closeKind);

    return (
      <div
        key={entry.historyRecordId}
        role="button"
        tabIndex={0}
        className={cardClass}
        onClick={() => setSelectedEntry(entry)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setSelectedEntry(entry);
          }
        }}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
          <span className="font-medium text-brand-text">
            {i18n.table} {entry.displayName}
          </span>
          {META_SEP}
          <OrderHistoryOutcomeBadge badge={outcomeBadge} />
          {!isOperationalSource ? (
            <>
              {META_SEP}
              <span className="text-brand-text-muted">
                {entry.itemCount} {i18n.items}
              </span>
              {META_SEP}
              {renderMetaAmount(entry)}
              {renderPrintButton(entry)}
            </>
          ) : null}
        </div>
        <OrderHistoryLifecycleSteps
          steps={lifecycleSteps}
          i18n={i18n}
          className="mt-2 space-y-0.5 text-[13px] text-brand-text-muted"
        />
        {mergeSummaryLine ? (
          <p className="mt-0.5 text-[13px] text-brand-text">{mergeSummaryLine}</p>
        ) : null}
        {forcedCloseSummary ? (
          <p className={ORDER_HISTORY_FORCED_SUMMARY_CLASS}>{forcedCloseSummary}</p>
        ) : null}
      </div>
    );
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
          className="w-full text-base"
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
                onSelect={onPickerSelect}
                className="mesa-rdp mesa-rdp--brand"
              />
              <div className="mt-3 flex items-center justify-between">
                <button type="button" onClick={resetRange} className="text-[13px] text-brand-text-muted hover:text-brand-text">
                  {i18n.resetDate}
                </button>
                <button type="button" onClick={() => setPickerOpen(false)} className="text-[13px] text-brand-gold hover:underline">
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
          <p className="text-brand-text-muted">{i18n.loading}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
          <p className="text-brand-text-muted">{i18n.empty}</p>
        </div>
      ) : (
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
          <div className="space-y-3 p-3">
            {entries.map(renderHistoryCard)}
            {loading ? (
              <p className="py-2 text-center text-[13px] text-brand-text-muted">{i18n.loading}</p>
            ) : null}
          </div>
          <ListPaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            labels={{
              pageInfo: i18n.pageInfo,
              pageSizeLabel: i18n.pageSizeLabel,
              pagePrev: i18n.pagePrev,
              pageNext: i18n.pageNext,
            }}
            onPageChange={goToPage}
            onPageSizeChange={(next: ListPageSize) => changePageSize(next)}
            disabled={loading}
          />
        </div>
      )}

      <OrderHistoryDetailModal
        entry={selectedEntry}
        entries={entries}
        itemCodeByMenuId={itemCodeByMenuId}
        restaurantSlug={restaurantSlug}
        onClose={() => setSelectedEntry(null)}
        onSelectEntry={setSelectedEntry}
      />
    </div>
  );
}
