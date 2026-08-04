'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  UI_LANGUAGE_OPTIONS,
  uiLanguageOption,
  type UILanguage,
} from '@/lib/i18n';

interface LanguageSwitcherProps {
  compact?: boolean;
  /**
   * - inline: flag/code pills (landing, auth, customer header)
   * - menu / icon: compact trigger + dropdown
   * - nested: one row showing current language; expands to scrollable list (account menu)
   */
  variant?: 'inline' | 'menu' | 'icon' | 'nested';
  /** Match customer menu header pills (flag + code). */
  showFlags?: boolean;
  /** Dropdown panel placement for menu/icon variants. */
  dropdownPlacement?: 'above' | 'below';
  /** Horizontal alignment of the dropdown panel. */
  dropdownAlign?: 'start' | 'end';
}

function dropdownPanelPositionClass(
  placement: 'above' | 'below',
  align: 'start' | 'end',
): string {
  const vertical =
    placement === 'below' ? 'top-full mt-1.5' : 'bottom-full mb-1.5';
  const horizontal = align === 'end' ? 'right-0' : 'left-0';
  return `absolute ${vertical} ${horizontal}`;
}

function menuDropdownPanelClass(placement: 'above' | 'below'): string {
  const vertical =
    placement === 'below' ? 'top-full mt-1.5' : 'bottom-full mb-1.5';
  return `absolute ${vertical} left-0 right-0`;
}

function OptionRows({
  lang,
  onSelect,
}: {
  lang: UILanguage;
  onSelect: (id: UILanguage) => void;
}) {
  return (
    <>
      {UI_LANGUAGE_OPTIONS.map((option) => {
        const selected = lang === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onSelect(option.id)}
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
              selected
                ? 'bg-brand-gold/15 text-brand-text font-medium'
                : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-bg/70'
            }`}
          >
            <span aria-hidden className="shrink-0 text-base leading-none">
              {option.flag}
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{option.nativeName}</span>
            {selected ? (
              <span aria-hidden className="shrink-0 text-brand-gold">
                ✓
              </span>
            ) : (
              <span aria-hidden className="shrink-0 w-3" />
            )}
          </button>
        );
      })}
    </>
  );
}

export function LanguageSwitcher({
  compact = false,
  variant = 'inline',
  showFlags = false,
  dropdownPlacement = 'above',
  dropdownAlign = 'start',
}: LanguageSwitcherProps) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = uiLanguageOption(lang);
  const listLabel = getMessages(lang).nav.languageSettings;

  useEffect(() => {
    if ((variant !== 'menu' && variant !== 'icon' && variant !== 'nested') || !open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open, variant]);

  const selectLang = (optionId: UILanguage) => {
    if (optionId === lang) {
      setOpen(false);
      return;
    }
    setLang(optionId);
    setOpen(false);
  };

  if (variant === 'nested') {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg px-0 py-1.5 text-sm text-brand-text transition-colors hover:text-brand-gold"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={listLabel}
        >
          <span aria-hidden className="shrink-0">
            🌐
          </span>
          <span className="min-w-0 flex-1 truncate text-left font-medium">{listLabel}</span>
          <span className="shrink-0 text-brand-text-muted">{current.nativeName}</span>
          <span aria-hidden className="shrink-0 text-brand-text-muted">
            ›
          </span>
        </button>
        {open ? (
          <div
            role="listbox"
            aria-label={listLabel}
            className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-brand-border bg-brand-card py-1 shadow-sm"
          >
            <OptionRows lang={lang} onSelect={selectLang} />
          </div>
        ) : null}
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-9 w-9 rounded-full border border-brand-border bg-brand-bg text-sm text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
          title={current.nativeName}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={current.nativeName}
        >
          🌐
        </button>
        {open ? (
          <div
            role="listbox"
            aria-label={listLabel}
            className={`${dropdownPanelPositionClass(dropdownPlacement, dropdownAlign)} max-h-56 min-w-[10rem] overflow-y-auto rounded-xl border border-brand-border bg-brand-card py-1 shadow-sm`}
          >
            <OptionRows lang={lang} onSelect={selectLang} />
          </div>
        ) : null}
      </div>
    );
  }

  if (variant === 'menu') {
    return (
      <div ref={rootRef} className="relative flex-1 min-w-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-xl border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span aria-hidden>🌐</span>
          <span className="truncate">{current.nativeName}</span>
        </button>
        {open ? (
          <div
            role="listbox"
            aria-label={listLabel}
            className={`${menuDropdownPanelClass(dropdownPlacement)} max-h-56 overflow-y-auto rounded-xl border border-brand-border bg-brand-card py-1 shadow-sm`}
          >
            <OptionRows lang={lang} onSelect={selectLang} />
          </div>
        ) : null}
      </div>
    );
  }

  const pillTextClass = showFlags ? 'text-[13px]' : 'text-xs';

  return (
    <div
      className={`flex flex-wrap items-center gap-1 bg-brand-card border border-brand-border rounded-full p-1 ${compact ? '' : 'w-fit'}`}
      role="listbox"
      aria-label={listLabel}
    >
      {UI_LANGUAGE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="option"
          aria-selected={lang === option.id}
          onClick={() => selectLang(option.id)}
          className={`px-2.5 py-1 rounded-full ${pillTextClass} transition-all ${
            lang === option.id
              ? 'bg-brand-gold text-brand-on-gold font-semibold'
              : 'text-brand-text-muted hover:text-brand-text'
          }`}
        >
          {showFlags ? `${option.flag} ${option.shortLabel}` : option.shortLabel}
        </button>
      ))}
    </div>
  );
}
