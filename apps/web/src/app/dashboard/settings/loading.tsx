export default function SettingsLoading() {
  return (
    <div className="w-full min-w-0 max-w-full animate-pulse">
      <div className="mb-5 flex min-w-max gap-1 border-b border-brand-border/80 px-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-24 rounded-t bg-brand-border/35" />
        ))}
      </div>
      <div className="mb-4 space-y-2">
        <div className="h-8 w-48 rounded-lg bg-brand-border/40" />
        <div className="h-4 w-full max-w-xl rounded bg-brand-border/25" />
      </div>
      <div className="max-w-2xl space-y-4 rounded-xl border border-brand-border bg-brand-card p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 rounded bg-brand-border/35" />
            <div className="h-10 w-full rounded-lg bg-brand-border/25" />
          </div>
        ))}
      </div>
    </div>
  );
}
