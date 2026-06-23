'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import {
  daysUntilValidUntil,
  formatValidUntilDate,
  type PrintAgentDeviceRow,
} from '@/lib/print-agent-credential-expiry';
import { getMessages } from '@/lib/i18n/messages';

const UI_LOCALE: Record<string, string> = { zh: 'zh-CN', en: 'en-GB', pt: 'pt-PT' };

type Props = {
  devices: PrintAgentDeviceRow[];
  variant?: 'bar' | 'panel';
};

export function PrintAgentCredentialExpiryAlert({ devices, variant = 'bar' }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).printAssistant;
  const dateLocale = UI_LOCALE[lang] ?? 'en-GB';

  if (!devices.length) {
    return null;
  }

  const soonest = devices[0]!;
  const days = daysUntilValidUntil(soonest.valid_until);
  const dateStr = formatValidUntilDate(soonest.valid_until, dateLocale);

  const body =
    devices.length === 1
      ? t.credentialExpirySingle.replace('{date}', dateStr).replace('{days}', String(days))
      : t.credentialExpiryMultiple
          .replace('{count}', String(devices.length))
          .replace('{date}', dateStr)
          .replace('{days}', String(days));

  const className =
    variant === 'bar'
      ? 'mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950'
      : 'rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950';

  return (
    <div className={className} role="status">
      <p className="font-medium">{t.credentialExpiryTitle}</p>
      <p className="mt-1">{body}</p>
      <ul className="mt-2 list-inside list-disc text-amber-900/90">
        {devices.map((d) => (
          <li key={d.id}>
            {t.credentialExpiryDeviceRow
              .replace('{name}', d.label?.trim() || t.credentialExpiryUnlabeledName)
              .replace('{date}', formatValidUntilDate(d.valid_until, dateLocale))}
          </li>
        ))}
      </ul>
      <p className="mt-2">
        <Link
          href="/dashboard/settings/print-assistant"
          className="font-medium text-amber-950 underline underline-offset-2"
        >
          {t.credentialExpiryLink}
        </Link>
      </p>
    </div>
  );
}
