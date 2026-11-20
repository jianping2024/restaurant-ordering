/** Page content skeleton — tab chrome lives in DashboardSettingsShell. */
export default function SettingsLoading() {
  return (
    <div className="w-full min-w-0 max-w-full animate-pulse space-y-4">
      <div className="rounded-xl border border-brand-border bg-brand-card p-4 space-y-4">
        <div className="flex justify-between gap-3">
          <div className="h-4 w-64 max-w-full rounded bg-brand-border/25" />
          <div className="h-8 w-28 rounded-lg bg-brand-border/35 shrink-0" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-full rounded-lg bg-brand-border/25" />
        ))}
      </div>
    </div>
  );
}
