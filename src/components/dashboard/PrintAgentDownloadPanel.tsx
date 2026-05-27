'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { PrintAgentDownloadUrls, PublishedPrintAgentFallback } from '@/lib/print-agent-download';

type Props = {
  urls: PrintAgentDownloadUrls;
  version: string;
  /** False when GitHub has no assets for print-agent-v{version} (avoid /latest downgrade). */
  releaseReady?: boolean;
  /** Latest tag on GitHub with real installer files (may differ from VERSION). */
  publishedFallback?: PublishedPrintAgentFallback | null;
};

function withVersion(template: string, version: string) {
  return template.replaceAll('{version}', version);
}

export function PrintAgentDownloadPanel({
  urls,
  version,
  releaseReady = true,
  publishedFallback = null,
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).printAssistant;

  const showFallback =
    !releaseReady && publishedFallback && publishedFallback.version !== version;

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card p-4 sm:p-5 space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-brand-text">{t.downloadTitle}</h3>
          {version ? (
            <span className="inline-flex items-center rounded-md border border-brand-gold/40 bg-brand-gold/10 px-2 py-0.5 text-[12px] font-mono font-medium text-brand-gold">
              {withVersion(t.downloadVersionBadge, version)}
            </span>
          ) : null}
        </div>
        <p className="text-brand-text-muted text-sm mt-1">{t.downloadSubtitle}</p>
        {version ? (
          <p className="text-brand-text-muted text-[12px] mt-1">
            {withVersion(t.downloadVersionHint, version)}
          </p>
        ) : null}
        {version && !releaseReady ? (
          <p className="text-[13px] leading-relaxed mesa-alert-warning px-3 py-2 mt-2">
            {withVersion(t.downloadReleasePending, version)}
          </p>
        ) : null}
        {version ? (
          <p className="text-brand-text-muted text-[12px] mt-2 leading-relaxed">{t.downloadUpgradeSteps}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={urls.setupAmd64}
          aria-disabled={!releaseReady}
          className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            releaseReady
              ? 'bg-brand-gold text-brand-on-gold hover:bg-brand-gold-light'
              : 'pointer-events-none bg-brand-border text-brand-text-muted opacity-60'
          }`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {withVersion(t.downloadSetupAmd64, version)}
        </a>
        <a
          href={urls.zipAmd64}
          aria-disabled={!releaseReady}
          className={`inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm transition-colors ${
            releaseReady
              ? 'border-brand-border text-brand-text hover:border-brand-gold/50'
              : 'pointer-events-none border-brand-border text-brand-text-muted opacity-60'
          }`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {withVersion(t.downloadZipAmd64, version)}
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

      {showFallback ? (
        <div className="border-t border-brand-border/60 pt-3 space-y-2">
          <p className="text-[13px] text-brand-text-muted leading-relaxed">
            {withVersion(t.downloadFallbackIntro, publishedFallback.version)}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={publishedFallback.setupAmd64}
              className="inline-flex items-center justify-center rounded-lg bg-brand-gold/90 text-brand-on-gold px-4 py-2 text-sm font-semibold hover:bg-brand-gold-light transition-colors"
              rel="noopener noreferrer"
              target="_blank"
            >
              {withVersion(t.downloadFallbackSetup, publishedFallback.version)}
            </a>
            <a
              href={publishedFallback.zipAmd64}
              className="inline-flex items-center justify-center rounded-lg border border-brand-gold/50 text-brand-text px-4 py-2 text-sm hover:border-brand-gold/70 transition-colors"
              rel="noopener noreferrer"
              target="_blank"
            >
              {withVersion(t.downloadFallbackZip, publishedFallback.version)}
            </a>
            <a
              href={publishedFallback.releasesPage}
              className="inline-flex items-center justify-center rounded-lg border border-brand-border text-brand-text-muted px-4 py-2 text-sm hover:border-brand-gold/50 transition-colors"
              rel="noopener noreferrer"
              target="_blank"
            >
              {withVersion(t.downloadFallbackRelease, publishedFallback.version)}
            </a>
          </div>
        </div>
      ) : null}

      <p className="text-brand-text-muted text-[13px] leading-relaxed">{t.downloadArm64Hint}</p>
      <p className="text-[13px] leading-relaxed mesa-alert-warning px-3 py-2">
        {t.downloadSmartScreen}
      </p>
    </div>
  );
}
