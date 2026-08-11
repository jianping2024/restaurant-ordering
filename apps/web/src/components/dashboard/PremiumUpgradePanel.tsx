'use client';

import Link from 'next/link';
import { LandingContactChannels } from '@/components/landing/LandingContactChannels';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getLandingCopy } from '@/lib/landing/copy';
import { getMessages } from '@/lib/i18n/messages';
import type { PremiumKey } from '@mesa/shared';

type Props = {
  feature: PremiumKey;
};

const FEATURE_LABEL_KEY: Record<PremiumKey, keyof ReturnType<typeof getMessages>['premiumUpgrade']['features']> = {
  value_analytics: 'valueAnalytics',
  abnormal_ops: 'abnormalOps',
  operation_logs: 'operationLogs',
};

/** Pro upgrade gate — contact channels reuse landing sole source (`LandingContactChannels`). */
export function PremiumUpgradePanel({ feature }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).premiumUpgrade;
  const contact = getLandingCopy(lang).contact;
  const featureLabel = t.features[FEATURE_LABEL_KEY[feature]];

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">{t.proBadge}</p>
      <h1 className="mt-3 font-heading text-3xl text-brand-text">{t.title}</h1>
      <p className="mt-3 text-sm text-brand-text-muted">{t.desc.replace('{feature}', featureLabel)}</p>
      <p className="mt-6 text-sm text-brand-text">{t.contactHint}</p>
      <div className="mt-6 text-left">
        <LandingContactChannels
          labels={{
            whatsappLabel: contact.whatsappLabel,
            wechatLabel: contact.wechatLabel,
            wechatScanHint: contact.wechatScanHint,
            wechatCopy: contact.wechatCopy,
            wechatCopied: contact.wechatCopied,
          }}
        />
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
