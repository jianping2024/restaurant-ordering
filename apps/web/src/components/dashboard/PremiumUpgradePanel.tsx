'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { PremiumKey } from '@mesa/shared';

type Props = {
  feature: PremiumKey;
  wechatUrl: string | null;
  whatsappUrl: string | null;
};

const FEATURE_LABEL_KEY: Record<PremiumKey, keyof ReturnType<typeof getMessages>['premiumUpgrade']['features']> = {
  value_analytics: 'valueAnalytics',
  abnormal_ops: 'abnormalOps',
  operation_logs: 'operationLogs',
};

export function PremiumUpgradePanel({ feature, wechatUrl, whatsappUrl }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).premiumUpgrade;
  const featureLabel = t.features[FEATURE_LABEL_KEY[feature]];

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">{t.proBadge}</p>
      <h1 className="mt-3 font-heading text-3xl text-brand-text">{t.title}</h1>
      <p className="mt-3 text-sm text-brand-text-muted">{t.desc.replace('{feature}', featureLabel)}</p>
      <p className="mt-6 text-sm text-brand-text">{t.contactHint}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {wechatUrl ? (
          <a
            href={wechatUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg border border-brand-gold/50 bg-brand-gold/10 px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-gold/20"
          >
            {t.wechatCta}
          </a>
        ) : null}
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg border border-brand-border bg-brand-card px-4 py-2 text-sm font-medium text-brand-text hover:border-brand-gold/50"
          >
            {t.whatsappCta}
          </a>
        ) : null}
      </div>
      <Link
        href="/dashboard"
        className="mt-10 inline-block text-sm text-brand-text-muted hover:text-brand-text underline-offset-4 hover:underline"
      >
        {t.backToDashboard}
      </Link>
    </div>
  );
}
