import { waiterUi } from '@/components/waiter/waiter-ui';

export default function DashboardWaiterTableLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <div className="h-8 w-40 rounded-lg bg-brand-border/40 animate-pulse" />
      <div className={`${waiterUi.cardSurface} p-6 animate-pulse space-y-3`}>
        <div className="h-5 w-32 rounded bg-brand-border/50" />
        <div className="h-4 w-full rounded bg-brand-border/30" />
        <div className="h-4 w-5/6 rounded bg-brand-border/30" />
      </div>
      <div className={`${waiterUi.cardSurface} p-6 animate-pulse space-y-3`}>
        <div className="h-5 w-24 rounded bg-brand-border/50" />
        <div className="h-16 w-full rounded bg-brand-border/30" />
      </div>
    </div>
  );
}
