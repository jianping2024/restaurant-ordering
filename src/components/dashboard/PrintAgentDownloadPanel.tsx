'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { PrintAgentDownloadUrls } from '@/lib/print-agent-download';

type Props = {
  urls: PrintAgentDownloadUrls;
};

export function PrintAgentDownloadPanel({ urls }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).printAssistant;

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card p-4 sm:p-5 space-y-3">
      <div>
        <h3 className="font-medium text-brand-text">{t.downloadTitle}</h3>
        <p className="text-brand-text-muted text-sm mt-1">{t.downloadSubtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={urls.setupAmd64}
          className="inline-flex items-center justify-center rounded-lg bg-brand-gold text-brand-bg px-4 py-2 text-sm font-semibold hover:bg-brand-gold-light transition-colors"
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
      <p className="text-brand-text-muted text-[13px] leading-relaxed border border-amber-500/30 bg-amber-500/8 rounded-lg px-3 py-2">
        {t.downloadSmartScreen}
      </p>
    </div>
  );
}
