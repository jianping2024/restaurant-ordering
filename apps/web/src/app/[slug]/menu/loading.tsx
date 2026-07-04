export default function CustomerMenuLoading() {
  return (
    <div className="min-h-screen bg-brand-bg max-w-mobile mx-auto animate-pulse">
      <div className="sticky top-0 z-20 border-b border-brand-border/40 bg-brand-bg px-4 py-3">
        <div className="h-6 w-32 rounded bg-brand-border/40" />
        <div className="mt-2 h-4 w-20 rounded bg-brand-border/30" />
      </div>
      <div className="flex gap-2 overflow-hidden px-4 py-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-9 w-16 shrink-0 rounded-full bg-brand-border/40" />
        ))}
      </div>
      <div className="space-y-3 px-4 py-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-xl border border-brand-border/40 p-4 space-y-2">
            <div className="h-5 w-3/5 rounded bg-brand-border/40" />
            <div className="h-4 w-full rounded bg-brand-border/30" />
            <div className="flex justify-between pt-1">
              <div className="h-8 w-20 rounded-lg bg-brand-border/40" />
              <div className="h-8 w-8 rounded-full bg-brand-border/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
