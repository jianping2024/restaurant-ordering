'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { UILanguage } from '@/lib/i18n';

const OPTIONS: { id: UILanguage; label: string; menuLabel: string }[] = [
  { id: 'zh', label: '中', menuLabel: '中文' },
  { id: 'en', label: 'EN', menuLabel: 'EN' },
  { id: 'pt', label: 'PT', menuLabel: 'PT' },
];

interface LanguageSwitcherProps {
  compact?: boolean;
  variant?: 'inline' | 'menu' | 'icon';
}

export function LanguageSwitcher({ compact = false, variant = 'inline' }: LanguageSwitcherProps) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = OPTIONS.find((o) => o.id === lang) ?? OPTIONS[0];

  useEffect(() => {
    if ((variant !== 'menu' && variant !== 'icon') || !open) return;

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

  if (variant === 'icon') {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-9 w-9 rounded-full border border-brand-border bg-brand-bg text-sm text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
          title={current.menuLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={current.menuLabel}
        >
          🌐
        </button>
        {open ? (
          <div
            role="listbox"
            className="absolute bottom-full left-0 mb-1.5 min-w-[7rem] rounded-xl border border-brand-border bg-brand-card py-1 shadow-sm"
          >
            {OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={lang === option.id}
                onClick={() => selectLang(option.id)}
                className={`flex w-full items-center px-3 py-2 text-sm transition-colors ${
                  lang === option.id
                    ? 'bg-brand-gold/15 text-brand-gold font-medium'
                    : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-border/50'
                }`}
              >
                {option.menuLabel}
              </button>
            ))}
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
          <span className="truncate">{current.menuLabel}</span>
        </button>
        {open ? (
          <div
            role="listbox"
            className="absolute bottom-full left-0 right-0 mb-1.5 rounded-xl border border-brand-border bg-brand-card py-1 shadow-sm"
          >
            {OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={lang === option.id}
                onClick={() => selectLang(option.id)}
                className={`flex w-full items-center px-3 py-2 text-sm transition-colors ${
                  lang === option.id
                    ? 'bg-brand-gold/15 text-brand-gold font-medium'
                    : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-border/50'
                }`}
              >
                {option.menuLabel}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 bg-brand-card border border-brand-border rounded-full p-1 ${compact ? '' : 'w-fit'}`}>
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          onClick={() => selectLang(option.id)}
          className={`px-2.5 py-1 rounded-full text-xs transition-all ${
            lang === option.id
              ? 'bg-brand-gold text-brand-on-gold font-semibold'
              : 'text-brand-text-muted hover:text-brand-text'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
