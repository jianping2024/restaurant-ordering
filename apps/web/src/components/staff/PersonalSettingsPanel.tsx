'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PrintNotifyModeText } from '@/components/print-agent/PrintNotifyModeText';
import { getMessages } from '@/lib/i18n/messages';
import {
  resolveRestaurantPrintNotifyMode,
  type PrintAgentDeviceHeartbeatRow,
  type PrintAgentNotificationMode,
} from '@/lib/print-agent-heartbeat';

export function PersonalSettingsPanel() {
  const { lang } = useLanguage();
  const t = getMessages(lang).nav;
  const printT = getMessages(lang).printAssistant;
  const [notifyMode, setNotifyMode] = useState<PrintAgentNotificationMode | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/print-agent/devices', { credentials: 'include' });
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) setNotifyMode(undefined);
          return;
        }
        if (!res.ok) {
          if (!cancelled) setNotifyMode(undefined);
          return;
        }
        const json = (await res.json()) as { devices?: PrintAgentDeviceHeartbeatRow[] };
        if (!cancelled) {
          setNotifyMode(resolveRestaurantPrintNotifyMode(json.devices || []));
        }
      } catch {
        if (!cancelled) setNotifyMode(undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {notifyMode !== undefined ? (
        <section className="border-b border-brand-border/70 px-3 py-2">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-brand-text-muted">
            <span aria-hidden>🖨</span>
            <span>{printT.devicesNotificationMode}</span>
          </p>
          <div className="px-0 text-sm">
            <PrintNotifyModeText mode={notifyMode} />
          </div>
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
        <p className="mb-1 flex items-center gap-1.5 px-0 text-[11px] font-medium text-brand-text-muted">
          <span aria-hidden>🌐</span>
          <span>{t.languageSettings}</span>
        </p>
        <LanguageSwitcher variant="list" />
      </section>
    </>
  );
}
