import { PrintAgentDownloadPanel } from '@/components/dashboard/PrintAgentDownloadPanel';
import {
  getPrintAgentDownloadUrls,
  getPrintAgentVersion,
  resolvePrintAgentDownloadStatus,
} from '@/lib/print-agent-download';

export function PrintAgentDownloadSkeleton() {
  return (
    <div
      className="rounded-2xl border border-brand-border bg-brand-card p-4 sm:p-5 space-y-3 animate-pulse"
      aria-busy="true"
      aria-label="Loading download section"
    >
      <div className="h-5 w-40 rounded bg-brand-border/60" />
      <div className="h-4 w-full max-w-md rounded bg-brand-border/40" />
      <div className="flex flex-wrap gap-2 pt-1">
        <div className="h-9 w-36 rounded-lg bg-brand-border/50" />
        <div className="h-9 w-32 rounded-lg bg-brand-border/40" />
      </div>
    </div>
  );
}

export async function PrintAgentDownloadSection({ siteOrigin }: { siteOrigin: string }) {
  const urls = getPrintAgentDownloadUrls(siteOrigin);
  if (!urls) return null;

  const version = getPrintAgentVersion();
  const { releaseReady, publishedFallback } = await resolvePrintAgentDownloadStatus();

  return (
    <PrintAgentDownloadPanel
      urls={urls}
      version={version}
      releaseReady={releaseReady}
      publishedFallback={publishedFallback}
    />
  );
}
