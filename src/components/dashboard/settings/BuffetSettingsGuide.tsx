'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { SettingsPageHelp } from '@/components/dashboard/settings/SettingsPageHelp';

export function BuffetSettingsGuide() {
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;
  const t = getMessages(lang).buffetAdmin;

  return (
    <SettingsPageHelp title={t.guideTitle} triggerLabel={hub.helpLabel}>
      <ol className="space-y-3 list-decimal list-outside pl-4 text-brand-text">
        <li>{t.guideStepBuffet}</li>
        <li>{t.guideStepSlots}</li>
        <li>{t.guideStepPrices}</li>
        <li>{t.guideStepSpecialDates}</li>
      </ol>
    </SettingsPageHelp>
  );
}
