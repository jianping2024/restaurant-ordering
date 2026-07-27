/** Skeleton for print-assistant upper panels while RSC streams. */
export function PrintAssistantUpperSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-xl border border-brand-border bg-brand-card p-5 space-y-3">
        <div className="h-5 w-40 rounded bg-brand-border/50" />
        <div className="h-4 w-full max-w-md rounded bg-brand-border/30" />
      </div>
      <div className="rounded-xl border border-brand-border bg-brand-card p-5 space-y-3">
        <div className="h-5 w-48 rounded bg-brand-border/50" />
        <div className="h-10 w-full rounded-lg bg-brand-border/30" />
      </div>
    </div>
  );
}
