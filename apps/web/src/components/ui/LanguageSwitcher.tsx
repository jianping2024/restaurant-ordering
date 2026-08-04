'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  UI_LANGUAGE_OPTIONS,
  uiLanguageOption,
  type UILanguage,
} from '@/lib/i18n';

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

/**
 * Sole UI language control: landing, auth, customer ordering header, personal settings.
 */
export function LanguageSwitcherIconChrome() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = uiLanguageOption(lang);
  const listLabel = getMessages(lang).nav.languageSettings;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const selectLang = (optionId: UILanguage) => {
    if (optionId === lang) {
      setOpen(false);
      return;
    }
    setLang(optionId);
    setOpen(false);
  };

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
          className="absolute top-full right-0 mt-1.5 max-h-56 min-w-[10rem] overflow-y-auto rounded-xl border border-brand-border bg-brand-card py-1 shadow-sm"
        >
          <OptionRows lang={lang} onSelect={selectLang} />
        </div>
      ) : null}
    </div>
  );
}
