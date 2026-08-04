'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PrintNotifyModeText } from '@/components/print-agent/PrintNotifyModeText';
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

  return (
    <>
      {notifyMode.status !== 'denied' ? (
        <section className="flex items-center gap-1.5 border-b border-brand-border/70 px-3 py-2 text-sm">
          <span aria-hidden className="text-[11px] text-brand-text-muted">
            🖨
          </span>
          <span className="text-[11px] font-medium text-brand-text-muted">
            {printT.devicesNotificationMode}:
          </span>
          <PrintNotifyModeText
            mode={notifyMode.status === 'ready' ? notifyMode.mode : null}
          />
        </section>
      ) : null}
      <section className="border-b border-brand-border/70 px-3 py-2">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-brand-text-muted">
          <span aria-hidden>🎨</span>
          <span>{t.appearanceSettings}</span>
        </p>
        <ThemeToggle variant="row" />
      </section>
      <section className="border-b border-brand-border/70 px-3 py-2">
        <LanguageSwitcher variant="nested" />
      </section>
    </>
  );
}
