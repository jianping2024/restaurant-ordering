'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  UI_LANGUAGE_PICKER_OPTIONS,
  uiLanguageOption,
  type UILanguage,
} from '@/lib/i18n';
import { appearanceChromeButtonClass, appearanceChromeGlyphClass } from '@/lib/appearance-chrome';
import { GlobeIcon } from '@/components/ui/appearance-icons';
import { personalSettingsDropdownRowClass } from '@/lib/dashboard-top-nav';

function OptionRows({
  lang,
  onSelect,
}: {
  lang: UILanguage;
  onSelect: (id: UILanguage) => void;
}) {
  // Picker list is UI_LANGUAGE_PICKER_OPTIONS; keep a hidden current lang so user can leave it.
  const options = UI_LANGUAGE_PICKER_OPTIONS.some((o) => o.id === lang)
    ? UI_LANGUAGE_PICKER_OPTIONS
    : [...UI_LANGUAGE_PICKER_OPTIONS, uiLanguageOption(lang)];
  return (
    <>
      {options.map((option) => {
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
                ? 'bg-brand-gold/15 font-medium text-brand-text'
                : 'text-brand-text-muted hover:bg-brand-bg/70 hover:text-brand-text'
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
              <span aria-hidden className="w-3 shrink-0" />
            )}
          </button>
        );
      })}
    </>
  );
}

type Props = {
  /**
   * `icon`: standalone globe (landing).
   * `segment`: globe + short code inside AppearanceChromeGroup (customer header, auth).
   * `settings-row`: personal-settings menu — whole row opens the same language list.
   */
  layout?: 'icon' | 'segment' | 'settings-row';
};

/**
 * Sole UI language control: landing, auth, customer ordering header, personal settings.
 */
export function LanguageSwitcherIconChrome({ layout = 'icon' }: Props) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = uiLanguageOption(lang);
  const nav = getMessages(lang).nav;
  const listLabel = nav.languageSettings;
  const glyphClass = appearanceChromeGlyphClass(layout === 'settings-row' ? 'icon' : layout);

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

  const listbox = open ? (
    <div
      role="listbox"
      aria-label={listLabel}
      className="absolute top-full right-0 z-[60] mt-1.5 max-h-56 min-w-[10rem] overflow-y-auto rounded-xl border border-brand-border bg-brand-card py-1 shadow-sm"
    >
      <OptionRows lang={lang} onSelect={selectLang} />
    </div>
  ) : null;

  if (layout === 'settings-row') {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${personalSettingsDropdownRowClass()} hover:bg-brand-border/50`}
          title={current.nativeName}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={listLabel}
        >
          <span className="min-w-0 truncate">{nav.language}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="max-w-[5.5rem] truncate text-sm text-brand-text-muted sm:max-w-[7rem]">
              {current.nativeName}
            </span>
            <span
              aria-hidden
              className={`${appearanceChromeButtonClass('icon')} pointer-events-none`}
            >
              <GlobeIcon className={glyphClass} />
            </span>
          </span>
        </button>
        {listbox}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={appearanceChromeButtonClass(layout)}
        title={current.nativeName}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={current.nativeName}
      >
        <GlobeIcon className={glyphClass} />
        {layout === 'segment' ? <span aria-hidden>{current.shortLabel}</span> : null}
      </button>
      {listbox}
    </div>
  );
}
