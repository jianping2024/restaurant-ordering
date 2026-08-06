/** Skeleton for print-assistant upper panels while RSC streams. */
import { printAssistantPanelShell } from '@/components/dashboard/print-assistant/print-assistant-ui';

export function PrintAssistantUpperSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className={`${printAssistantPanelShell} space-y-3`}>
        <div className="h-5 w-40 rounded bg-brand-border/50" />
        <div className="h-4 w-full max-w-md rounded bg-brand-border/30" />
      </div>
      <div className={`${printAssistantPanelShell} space-y-3`}>
        <div className="h-5 w-48 rounded bg-brand-border/50" />
        <div className="h-4 w-full max-w-lg rounded bg-brand-border/30" />
        <div className="h-24 w-full rounded-lg bg-brand-border/30" />
      </div>
      <div className={`${printAssistantPanelShell} space-y-3`}>
        <div className="h-5 w-48 rounded bg-brand-border/50" />
        <div className="h-10 w-full rounded-lg bg-brand-border/30" />
      </div>
    </div>
  );
}
