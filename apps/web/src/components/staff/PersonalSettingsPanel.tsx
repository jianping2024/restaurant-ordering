'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcherIconChrome } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PrintNotifyModeText } from '@/components/print-agent/PrintNotifyModeText';
import { personalSettingsDropdownRowClass } from '@/lib/dashboard-top-nav';
import { getMessages } from '@/lib/i18n/messages';
import type { PrintAgentNotificationMode } from '@/lib/print-agent-heartbeat';

/** Single view-model for the 运行方式 block in personal settings. */
export type PersonalSettingsNotifyMode =
  | { status: 'loading' }
  | { status: 'ready'; mode: PrintAgentNotificationMode | null }
  | { status: 'denied' };

type Props = {
  notifyMode: PersonalSettingsNotifyMode;
};

export function PersonalSettingsPanel({ notifyMode }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).nav;
  const printT = getMessages(lang).printAssistant;
  const rowClass = personalSettingsDropdownRowClass();

  return (
    <>
      {notifyMode.status !== 'denied' ? (
        <div className={rowClass}>
          <div className="flex min-w-0 items-center gap-1.5 text-brand-text-muted">
            <span aria-hidden className="shrink-0 text-[11px]">
              🖨
            </span>
            <span className="shrink-0 text-[11px] font-medium">
              {printT.devicesNotificationMode}:
            </span>
            <PrintNotifyModeText
              mode={notifyMode.status === 'ready' ? notifyMode.mode : null}
            />
          </div>
        </div>
      ) : null}
      <div className={rowClass}>
        <span className="min-w-0 truncate">{t.language}</span>
        <LanguageSwitcherIconChrome showCurrentLanguage />
      </div>
      <div className={rowClass}>
        <span className="min-w-0 truncate">{t.darkMode}</span>
        <ThemeToggle />
      </div>
    </>
  );
}
