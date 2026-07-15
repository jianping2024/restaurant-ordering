import type { CustomerSubmittedOrderGroup } from '@/lib/customer-submitted-order-display';

type Props = {
  groups: CustomerSubmittedOrderGroup[];
  emptyLabel: string;
  submittedHint?: string;
  loading?: boolean;
};

function BatchTimeDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="flex-1 border-t border-dashed border-brand-border" aria-hidden="true" />
      <time className="text-[12px] text-brand-text-muted shrink-0 tabular-nums">{label}</time>
    </div>
  );
}

export function CustomerOrderedItemsList({
  groups,
  emptyLabel,
  submittedHint,
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-2 animate-pulse" aria-hidden="true">
        <div className="h-4 w-2/3 rounded bg-brand-border/40" />
        <div className="h-14 rounded-xl bg-brand-border/30" />
      </div>
    );
  }

  if (groups.length === 0) {
    return <p className="text-brand-text-muted text-sm">{emptyLabel}</p>;
  }

  return (
    <>
      {submittedHint ? (
        <p className="text-brand-text-muted text-[12px] mb-3">{submittedHint}</p>
      ) : null}
      <div className="space-y-4">
        {groups.map((group) => (
          <section key={group.groupKey}>
            <BatchTimeDivider label={group.submittedTimeLabel} />
            <div className="space-y-1">
              {group.lines.map((line) => (
                <p key={line.key} className="text-sm text-brand-text">
                  {line.label}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
