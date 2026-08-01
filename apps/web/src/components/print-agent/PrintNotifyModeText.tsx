'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  printNotifyModeClass,
  type PrintAgentNotificationMode,
} from '@/lib/print-agent-heartbeat';

/** Single UI representation of print-agent notification_mode labels + tone. */
export function PrintNotifyModeText({ mode }: { mode: PrintAgentNotificationMode | null }) {
  const { lang } = useLanguage();
  const t = getMessages(lang).printAssistant;
  const text =
    mode === 'realtime'
      ? t.notificationModeRealtime
      : mode === 'polling'
        ? t.notificationModePolling
        : '—';
  return <span className={printNotifyModeClass(mode)}>{text}</span>;
}
