'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker, type Matcher } from 'react-day-picker';
import { format, isValid, parse } from 'date-fns';
import { enUS, pt, zhCN } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import 'react-day-picker/dist/style.css';
import './date-picker.css';

export type DatePickerLang = 'zh' | 'en' | 'pt';
export type DatePickerVariant = 'brand' | 'zinc';

const LOCALES: Record<DatePickerLang, Locale> = {
  zh: zhCN,
  en: enUS,
  pt,
};

const POPUP_GAP = 6;
const POPUP_MIN_WIDTH = 280;
const VIEWPORT_PAD = 8;

const VARIANT_UI: Record<
  DatePickerVariant,
  { trigger: string; popup: string; rdp: string }
> = {
  brand: {
    trigger:
      'mt-0.5 w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-left text-sm text-brand-text transition-colors hover:border-brand-gold/40 focus:outline-none focus:ring-2 focus:ring-brand-gold/35 disabled:cursor-not-allowed disabled:opacity-50',
    popup: 'fixed z-[100] rounded-xl border border-brand-border bg-brand-card p-3 shadow-xl',
    rdp: 'mesa-rdp mesa-rdp--brand',
  },
  zinc: {
    trigger:
      'mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-sm text-zinc-100 transition-colors hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:cursor-not-allowed disabled:opacity-50',
    popup: 'fixed z-[100] rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl',
    rdp: 'mesa-rdp mesa-rdp--zinc',
  },
};

function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = parse(value.trim(), 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : undefined;
}

function computePopupCoords(anchor: HTMLElement, popup: HTMLElement) {
  const anchorRect = anchor.getBoundingClientRect();
  const popupHeight = popup.offsetHeight;
  const popupWidth = Math.max(POPUP_MIN_WIDTH, popup.offsetWidth);

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const spaceAbove = anchorRect.top;
  const openUpward = spaceBelow < popupHeight + POPUP_GAP && spaceAbove > spaceBelow;

  let top = openUpward ? anchorRect.top - popupHeight - POPUP_GAP : anchorRect.bottom + POPUP_GAP;
  let left = anchorRect.left;

  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - popupWidth - VIEWPORT_PAD));
  top = Math.max(VIEWPORT_PAD, Math.min(top, window.innerHeight - popupHeight - VIEWPORT_PAD));

  return { top, left };
}

export interface DatePickerProps {
  value: string;
  onChange: (isoDate: string) => void;
  lang?: DatePickerLang;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  variant?: DatePickerVariant;
  /** Inclusive lower bound as yyyy-MM-dd */
  min?: string;
  /** Inclusive upper bound as yyyy-MM-dd */
  max?: string;
  /** Month shown when opening if no value yet */
  defaultMonth?: Date;
  triggerClassName?: string;
}

/**
 * Single-date picker (portal popup + DayPicker). Brand = tenant dashboard; zinc = ops.
 */
export function DatePicker({
  value,
  onChange,
  lang = 'zh',
  placeholder = '选择日期',
  disabled,
  className = '',
  variant = 'brand',
  min,
  max,
  defaultMonth,
  triggerClassName,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const locale = LOCALES[lang];
  const ui = VARIANT_UI[variant];

  const selected = useMemo(() => parseIsoDate(value), [value]);
  const minDate = useMemo(() => parseIsoDate(min), [min]);
  const maxDate = useMemo(() => parseIsoDate(max), [max]);

  const label = useMemo(() => {
    if (!selected) return placeholder;
    return format(selected, 'PP', { locale });
  }, [selected, placeholder, locale]);

  const { startMonth, endMonth } = useMemo(() => {
    const y = new Date().getFullYear();
    return { startMonth: new Date(y - 3, 0, 1), endMonth: new Date(y + 8, 11, 31) };
  }, []);

  const disabledMatchers = useMemo(() => {
    const matchers: Matcher[] = [];
    if (minDate) matchers.push({ before: minDate });
    if (maxDate) matchers.push({ after: maxDate });
    return matchers.length > 0 ? matchers : undefined;
  }, [minDate, maxDate]);

  const updateCoords = useCallback(() => {
    const anchor = anchorRef.current;
    const popup = popupRef.current;
    if (!anchor || !popup) return;
    setCoords(computePopupCoords(anchor, popup));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  return (
    <div ref={anchorRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={triggerClassName ?? ui.trigger}
      >
        <span
          className={
            selected
              ? variant === 'brand'
                ? 'text-brand-text'
                : 'text-zinc-100'
              : variant === 'brand'
                ? 'text-brand-text-muted'
                : 'text-zinc-500'
          }
        >
          {label}
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={popupRef}
            className={ui.popup}
            style={{
              minWidth: POPUP_MIN_WIDTH,
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              visibility: coords ? 'visible' : 'hidden',
            }}
          >
            <DayPicker
              mode="single"
              selected={selected}
              locale={locale}
              defaultMonth={selected ?? defaultMonth ?? minDate ?? new Date()}
              captionLayout="dropdown"
              startMonth={startMonth}
              endMonth={endMonth}
              disabled={disabledMatchers}
              className={ui.rdp}
              onSelect={(d) => {
                onChange(d ? format(d, 'yyyy-MM-dd') : '');
                setOpen(false);
              }}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
