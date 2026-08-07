'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

/** Empty settings hub when entry is granted but no settings child capability. */
export function SettingsHubEmpty() {
  const { lang } = useLanguage();
  const text = getMessages(lang).settingsHub.hubEmpty;
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card px-4 py-8 text-center">
      <p className="text-sm text-brand-text-muted" data-testid="settings-hub-empty">
        {text}
      </p>
    </div>
  );
}
