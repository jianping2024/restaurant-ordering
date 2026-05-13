'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, isValid, parse } from 'date-fns';
import { enUS, pt, zhCN } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import type { UILanguage } from '@/lib/i18n';
import 'react-day-picker/dist/style.css';

const LOCALES: Record<UILanguage, Locale> = {
  zh: zhCN,
  en: enUS,
  pt,
};

function parseIsoDate(value: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = parse(value.trim(), 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : undefined;
}

export interface DashboardDatePickerProps {
  value: string;
  onChange: (isoDate: string) => void;
  lang: UILanguage;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  /** Month shown when opening if no value yet */
  defaultMonth?: Date;
}

/**
 * Single-date picker styled for Mesa dashboard (reuses `.orders-rdp` DayPicker theme in globals.css).
 */
export function DashboardDatePicker({
  value,
  onChange,
  lang,
  placeholder,
  disabled,
  className = '',
  defaultMonth,
}: DashboardDatePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const locale = LOCALES[lang];

  const selected = useMemo(() => parseIsoDate(value), [value]);

  const label = useMemo(() => {
    if (!selected) return placeholder;
    return format(selected, 'PP', { locale });
  }, [selected, placeholder, locale]);

  const { startMonth, endMonth } = useMemo(() => {
    const y = new Date().getFullYear();
    return { startMonth: new Date(y - 3, 0, 1), endMonth: new Date(y + 8, 11, 31) };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="mt-0.5 w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-left text-sm text-brand-text transition-colors hover:border-brand-gold/40 focus:outline-none focus:ring-2 focus:ring-brand-gold/35 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selected ? 'text-brand-text' : 'text-brand-text-muted'}>{label}</span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 min-w-[280px] rounded-xl border border-brand-border bg-brand-card p-3 shadow-xl left-0">
          <DayPicker
            mode="single"
            selected={selected}
            locale={locale}
            defaultMonth={selected ?? defaultMonth ?? new Date()}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            className="orders-rdp"
            onSelect={(d) => {
              if (d) {
                onChange(format(d, 'yyyy-MM-dd'));
              }
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
