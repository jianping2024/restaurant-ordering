'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { SettingsPageHelp } from '@/components/dashboard/settings/SettingsPageHelp';

export function MenuSettingsGuide() {
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;
  const t = getMessages(lang).menuManager;

  return (
    <SettingsPageHelp title={t.guideTitle} triggerLabel={hub.helpLabel}>
      <ol className="space-y-3 list-decimal list-outside pl-4 text-brand-text">
        <li>{t.guideStep1}</li>
        <li>{t.guideStep2}</li>
        <li>{t.guideStep3}</li>
      </ol>
    </SettingsPageHelp>
  );
}
