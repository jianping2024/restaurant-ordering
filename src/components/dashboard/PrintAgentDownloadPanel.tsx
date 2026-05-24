'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { PrintAgentDownloadUrls } from '@/lib/print-agent-download';

type Props = {
  urls: PrintAgentDownloadUrls;
  version: string;
};

export function PrintAgentDownloadPanel({ urls, version }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).printAssistant;

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card p-4 sm:p-5 space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-brand-text">{t.downloadTitle}</h3>
          {version ? (
            <span className="inline-flex items-center rounded-md border border-brand-gold/40 bg-brand-gold/10 px-2 py-0.5 text-[12px] font-mono font-medium text-brand-gold">
              {t.downloadVersionBadge.replace('{version}', version)}
            </span>
          ) : null}
        </div>
        <p className="text-brand-text-muted text-sm mt-1">{t.downloadSubtitle}</p>
        {version ? (
          <p className="text-brand-text-muted text-[12px] mt-1">
            {t.downloadVersionHint.replace('{version}', version)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={urls.setupAmd64}
          className="inline-flex items-center justify-center rounded-lg bg-brand-gold text-brand-on-gold px-4 py-2 text-sm font-semibold hover:bg-brand-gold-light transition-colors"
          rel="noopener noreferrer"
          target="_blank"
        >
          {t.downloadSetupAmd64}
        </a>
        <a
          href={urls.zipAmd64}
          className="inline-flex items-center justify-center rounded-lg border border-brand-border text-brand-text px-4 py-2 text-sm hover:border-brand-gold/50 transition-colors"
          rel="noopener noreferrer"
          target="_blank"
        >
          {t.downloadZipAmd64}
        </a>
        <a
          href={urls.releasesPage}
          className="inline-flex items-center justify-center rounded-lg border border-brand-border text-brand-text-muted px-4 py-2 text-sm hover:border-brand-gold/50 transition-colors"
          rel="noopener noreferrer"
          target="_blank"
        >
          {t.downloadAllReleases}
        </a>
      </div>
      <p className="text-brand-text-muted text-[13px] leading-relaxed">{t.downloadArm64Hint}</p>
      <p className="text-[13px] leading-relaxed mesa-alert-warning px-3 py-2">
        {t.downloadSmartScreen}
      </p>
    </div>
  );
}
