import type { CustomerSubmittedOrderGroup } from '@/lib/customer-submitted-order-display';

type Props = {
  groups: CustomerSubmittedOrderGroup[];
  emptyLabel: string;
  submittedHint?: string;
  loading?: boolean;
};

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
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.orderId} className="border border-brand-border rounded-xl p-3">
            <div className="mb-2">
              <span className="text-[13px] text-brand-text-muted">{group.submittedTimeLabel}</span>
            </div>
            <div className="space-y-1">
              {group.lines.map((line) => (
                <p key={line.key} className="text-sm text-brand-text">
                  {line.label}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
