'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

export function PrintAssistantIntro() {
  const { lang } = useLanguage();
  const t = getMessages(lang).printAssistant;

  return (
    <div>
      <h2 className="font-heading text-2xl text-brand-gold">{t.title}</h2>
      <p className="text-brand-text-muted text-sm mt-1 max-w-2xl">{t.subtitle}</p>
    </div>
  );
}
