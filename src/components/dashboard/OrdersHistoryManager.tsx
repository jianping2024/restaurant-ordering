'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Order, OrderStatus } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { DayPicker, type DateRange } from 'react-day-picker';
import { endOfMonth, format, startOfMonth, startOfToday, subDays } from 'date-fns';
import Select from 'react-select';
import type { MultiValue, StylesConfig } from 'react-select';
import 'react-day-picker/dist/style.css';
import { mergeTableNumbersWithOrderHistory } from '@/lib/restaurant-table-numbers';

interface Props {
  initialOrders: Order[];
  tableNumbers?: number[];
}

interface TableOption {
  value: number;
  label: string;
}

export function OrdersHistoryManager({ initialOrders, tableNumbers = [] }: Props) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;
  const locale = UI_LOCALE_BY_LANG[lang];
  const [selectedTables, setSelectedTables] = useState<TableOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const statusLabel: Record<OrderStatus, string> = {
    pending: i18n.pending,
    cooking: i18n.cooking,
    done: i18n.done,
  };
  const statusColor: Record<OrderStatus, string> = {
    pending: 'mesa-badge-danger',
    cooking: 'mesa-badge-warning',
    done: 'mesa-badge-success',
  };

  const tableOptions = useMemo<TableOption[]>(
    () =>
      mergeTableNumbersWithOrderHistory(tableNumbers, initialOrders).map((tableNo) => ({
        value: tableNo,
        label: `${i18n.table} ${tableNo}`,
      })),
    [i18n.table, initialOrders, tableNumbers],
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
    const selectedTableNumbers = new Set(selectedTables.map((item) => item.value));
    return initialOrders.filter(order => {
      if (selectedTableNumbers.size > 0 && !selectedTableNumbers.has(order.table_number)) return false;
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

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
  }, [initialOrders, selectedTables, statusFilter, dateRange]);

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

  const handlePrintOrder = (order: Order) => {
    const printWindow = window.open('', '_blank', 'width=700,height=900');
    if (!printWindow) return;

    const createdAt = new Date(order.created_at).toLocaleString(locale);
    const rows = order.items.map(item => `
      <tr>
        <td style="padding:6px 0;">${item.emoji} ${item.name_pt}</td>
        <td style="padding:6px 0; text-align:center;">x${item.qty}</td>
        <td style="padding:6px 0; text-align:right;">€${(item.price * item.qty).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head><title>${i18n.printTitle} #${order.id.slice(0, 8)}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px; color: #111;">
          <h2 style="margin-bottom: 8px;">${i18n.printTitle}</h2>
          <div style="font-size: 14px; margin-bottom: 14px;">
            <div>${i18n.table} ${order.table_number}</div>
            <div>${createdAt}</div>
            <div>${statusLabel[order.status]}</div>
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
          <div style="margin-top: 14px; text-align: right; font-weight: 700;">${i18n.printTotal}: €${order.total_amount.toFixed(2)}</div>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div>
      <div className="bg-brand-card border border-brand-border rounded-xl p-4 mb-4 grid gap-3 md:grid-cols-3">
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
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | OrderStatus)}
          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
        >
          <option value="all">{i18n.statusAll}</option>
          <option value="pending">{i18n.pending}</option>
          <option value="cooking">{i18n.cooking}</option>
          <option value="done">{i18n.done}</option>
        </select>
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
          {filteredOrders.map(order => (
            <div
              key={order.id}
              className="bg-brand-card border border-brand-border rounded-xl px-6 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-brand-text font-medium">{i18n.table} {order.table_number}</p>
                      <span className={`text-[13px] px-2 py-0.5 rounded-full ${statusColor[order.status]}`}>
                        {statusLabel[order.status]}
                      </span>
                    </div>
                    <p className="text-brand-text-muted text-[13px] mt-1">
                      {new Date(order.created_at).toLocaleString(locale)}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-brand-gold font-medium">€{order.total_amount.toFixed(2)}</p>
                  <p className="text-brand-text-muted text-[13px] mt-1">{order.items.length} {i18n.items}</p>
                  <button
                    type="button"
                    onClick={() => handlePrintOrder(order)}
                    className="mt-2 text-[13px] text-brand-gold hover:underline"
                  >
                    {i18n.print}
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-brand-border flex flex-wrap gap-3">
                {order.items.map((item, idx) => (
                  <span
                    key={idx}
                    className="text-[13px] bg-brand-border px-3 py-1 rounded-full text-brand-text-muted"
                  >
                    {item.emoji} {item.name_pt} x {item.qty}
                    {item.note && <span className="text-brand-text ml-1">({item.note})</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
