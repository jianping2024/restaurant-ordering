'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { getMessages } from '@/lib/i18n/messages';

export function PersonalSettingsPanel() {
  const { lang } = useLanguage();
  const t = getMessages(lang).nav;

  return (
    <>
      <section className="border-b border-brand-border/70 px-3 py-2">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-brand-text-muted">
          <span aria-hidden>🎨</span>
          <span>{t.appearanceSettings}</span>
        </p>
        <ThemeToggle variant="row" />
      </section>
      <section className="border-b border-brand-border/70 px-3 py-2">
        <p className="mb-1 flex items-center gap-1.5 px-0 text-[11px] font-medium text-brand-text-muted">
          <span aria-hidden>🌐</span>
          <span>{t.languageSettings}</span>
        </p>
        <LanguageSwitcher variant="list" />
      </section>
    </>
  );
}
