'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { endOfMonth, format, startOfMonth, startOfToday } from 'date-fns';
import 'react-day-picker/dist/style.css';
import '@mesa/ui/date-picker.css';
import { showToast } from '@/components/ui/Toast';
import {
  addCalendarDays,
  calendarDateInTimezone,
  daysBetweenInclusive,
} from '@/lib/lisbon-calendar';
import {
  defaultOrderHistoryClosedRange,
  formatOrderHistoryDateKey,
  formatOrderHistoryPickerFilter,
  orderHistoryClosedRangeToPicker,
  ORDER_HISTORY_MAX_RANGE_DAYS,
} from '@/lib/order-history/date-range';

export type DateRangePreset = 'today' | 'last7' | 'last30' | 'month';

export type DashboardDateRangeLabels = {
  filterDateRange: string;
  dateToday: string;
  dateLast7: string;
  dateLast30?: string;
  dateThisMonth?: string;
  resetDate: string;
  dateRangeTooLong: string;
};

type Props = {
  startDate: string;
  endDate: string;
  onChange: (next: { startDate: string; endDate: string }) => void;
  labels: DashboardDateRangeLabels;
  /** Default: today + last7 + month (order-history). */
  presets?: DateRangePreset[];
  maxRangeDays?: number;
  className?: string;
  triggerClassName?: string;
};

const DEFAULT_PRESETS: DateRangePreset[] = ['today', 'last7', 'month'];

/**
 * Sole dashboard list date-range control (button + DayPicker range).
 * Do not add a parallel range picker beside this.
 */
export function DashboardDateRangePicker({
  startDate,
  endDate,
  onChange,
  labels,
  presets = DEFAULT_PRESETS,
  maxRangeDays = ORDER_HISTORY_MAX_RANGE_DAYS,
  className = '',
  triggerClassName,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const dateRange = useMemo(
    () =>
      orderHistoryClosedRangeToPicker({
        closedFrom: startDate,
        closedTo: endDate,
      }),
    [startDate, endDate],
  );

  const rangeLabel = useMemo(() => {
    if (!dateRange?.from && !dateRange?.to) return labels.filterDateRange;
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, 'yyyy-MM-dd')} ~ ${format(dateRange.to, 'yyyy-MM-dd')}`;
    }
    if (dateRange?.from) return format(dateRange.from, 'yyyy-MM-dd');
    return labels.filterDateRange;
  }, [dateRange, labels.filterDateRange]);

  const emitClosed = (closed: { closedFrom: string; closedTo: string }) => {
    onChange({ startDate: closed.closedFrom, endDate: closed.closedTo });
  };

  const resetRange = () => {
    emitClosed(defaultOrderHistoryClosedRange());
  };

  const applyPreset = (preset: DateRangePreset) => {
    const today = startOfToday();
    if (preset === 'today') {
      const key = formatOrderHistoryDateKey(today);
      emitClosed({ closedFrom: key, closedTo: key });
      return;
    }
    if (preset === 'last7') {
      emitClosed(defaultOrderHistoryClosedRange());
      return;
    }
    if (preset === 'last30') {
      const to = calendarDateInTimezone(new Date());
      emitClosed({
        closedFrom: addCalendarDays(to, -29),
        closedTo: to,
      });
      return;
    }
    emitClosed({
      closedFrom: formatOrderHistoryDateKey(startOfMonth(today)),
      closedTo: formatOrderHistoryDateKey(endOfMonth(today)),
    });
  };

  const onPickerSelect = (next: DateRange | undefined) => {
    if (!next?.from) {
      resetRange();
      return;
    }
    const fromKey = formatOrderHistoryDateKey(next.from);
    const toKey = formatOrderHistoryDateKey(next.to ?? next.from);
    if (daysBetweenInclusive(fromKey, toKey) > maxRangeDays) {
      showToast(labels.dateRangeTooLong, 'error');
    }
    const closed = formatOrderHistoryPickerFilter(next);
    if (!closed) {
      resetRange();
      return;
    }
    emitClosed(closed);
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

  const presetLabel = (preset: DateRangePreset): string | null => {
    if (preset === 'today') return labels.dateToday;
    if (preset === 'last7') return labels.dateLast7;
    if (preset === 'last30') return labels.dateLast30 ?? null;
    return labels.dateThisMonth ?? null;
  };

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      <button
        type="button"
        onClick={() => setPickerOpen((value) => !value)}
        className={
          triggerClassName ??
          'w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-left text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40'
        }
      >
        {rangeLabel}
      </button>
      {pickerOpen && (
        <div className="absolute z-20 mt-2 right-0 bg-brand-card border border-brand-border rounded-xl p-3 shadow-xl min-w-[300px]">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {presets.map((preset) => {
              const label = presetLabel(preset);
              if (!label) return null;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="text-[13px] px-2 py-1 rounded border border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40"
                >
                  {label}
                </button>
              );
            })}
          </div>
          <DayPicker
            mode="range"
            selected={dateRange}
            onSelect={onPickerSelect}
            className="mesa-rdp mesa-rdp--brand"
          />
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={resetRange}
              className="text-[13px] text-brand-text-muted hover:text-brand-text"
            >
              {labels.resetDate}
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="text-[13px] text-brand-gold hover:underline"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
