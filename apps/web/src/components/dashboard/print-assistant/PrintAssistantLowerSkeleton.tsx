import { PrintAgentDownloadSkeleton } from '@/components/dashboard/PrintAgentDownloadSection';

/** Skeleton for print-assistant lower panels while RSC streams. */
export function PrintAssistantLowerSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <PrintAgentDownloadSkeleton />
      <div className="h-32 rounded-xl border border-brand-border/40 bg-brand-card/60" />
      <div className="h-48 rounded-xl border border-brand-border/40 bg-brand-card/60" />
    </div>
  );
}
