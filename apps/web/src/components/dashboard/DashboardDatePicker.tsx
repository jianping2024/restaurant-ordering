'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

const POPUP_GAP = 6;
const POPUP_MIN_WIDTH = 280;
const VIEWPORT_PAD = 8;

function parseIsoDate(value: string): Date | undefined {
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
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
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
        className="mt-0.5 w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-left text-sm text-brand-text transition-colors hover:border-brand-gold/40 focus:outline-none focus:ring-2 focus:ring-brand-gold/35 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selected ? 'text-brand-text' : 'text-brand-text-muted'}>{label}</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-[100] rounded-xl border border-brand-border bg-brand-card p-3 shadow-xl"
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
              defaultMonth={selected ?? defaultMonth ?? new Date()}
              captionLayout="dropdown"
              startMonth={startMonth}
              endMonth={endMonth}
              className="orders-rdp"
              onSelect={(d) => {
                if (d) onChange(format(d, 'yyyy-MM-dd'));
                setOpen(false);
              }}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
