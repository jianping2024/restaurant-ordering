'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CartQtyStepper } from '@/components/menu/CartQtyStepper';
import { CustomerMenuBottomSheet } from '@/components/menu/CustomerMenuBottomSheet';
import type { RoundReviewGroup } from '@/lib/table-order-round/own-review-lines';

type Labels = {
  title: string;
  empty: string;
  continueOrdering: string;
  sendRound: string;
  countdownBanner: string;
};

type Props = {
  open: boolean;
  groups: RoundReviewGroup[];
  labels: Labels;
  canSend: boolean;
  sendBusy: boolean;
  /** Countdown active — show banner; send button disabled. */
  countdownActive: boolean;
  countdownSeconds: number;
  /** lineId currently waiting on upsert/delete. */
  busyLineId: string | null;
  onClose: () => void;
  onSend: () => void;
  onOwnLineQtyChange: (lineId: string, nextQty: number) => void;
};

function BatchTimeDivider({ label }: { label: string }) {
  if (!label) {
    return <div className="mb-2 border-t border-dashed border-brand-border" aria-hidden="true" />;
  }
  return (
    <div className="mb-2 flex items-center gap-3">
      <div className="flex-1 border-t border-dashed border-brand-border" aria-hidden="true" />
      <span className="shrink-0 text-[12px] tabular-nums text-brand-text-muted">{label}</span>
      <div className="flex-1 border-t border-dashed border-brand-border" aria-hidden="true" />
    </div>
  );
}

/** Sole sushi round-review sheet: own lines use CartQtyStepper; peers read-only qty. */
export function SushiRoundReviewDrawer({
  open,
  groups,
  labels,
  canSend,
  sendBusy,
  countdownActive,
  countdownSeconds,
  busyLineId,
  onClose,
  onSend,
  onOwnLineQtyChange,
}: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open || !countdownActive) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [open, countdownActive]);

  const banner = countdownActive
    ? labels.countdownBanner.replace('{seconds}', String(Math.max(0, countdownSeconds)))
    : null;

  return (
    <CustomerMenuBottomSheet
      open={open}
      onClose={onClose}
      title={labels.title}
      footer={
        <div className="flex items-stretch gap-3">
          <Button
            type="button"
            variant="outline"
            size="action"
            className="min-w-0 flex-1 whitespace-nowrap"
            onClick={onClose}
          >
            {labels.continueOrdering}
          </Button>
          <Button
            type="button"
            variant="gold"
            size="action"
            className="min-w-0 flex-1 whitespace-nowrap"
            disabled={!canSend || sendBusy || countdownActive}
            loading={sendBusy}
            onClick={onSend}
          >
            {labels.sendRound}
          </Button>
        </div>
      }
    >
      {banner ? (
        <div className="mb-3 rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-3 py-2.5 text-[13px] font-semibold tabular-nums text-brand-gold">
          {banner}
        </div>
      ) : null}
      {groups.length === 0 ? (
        <p className="text-brand-text-muted text-sm">{labels.empty}</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group, index) => (
            <section key={group.groupKey}>
              {index > 0 || group.submittedTimeLabel ? (
                <BatchTimeDivider label={group.submittedTimeLabel} />
              ) : null}
              <div className="space-y-2">
                {group.lines.map((line) => (
                  <div
                    key={line.key}
                    className="flex items-center justify-between gap-3 text-sm text-brand-text"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{line.label}</p>
                      {line.note ? (
                        <p className="mt-0.5 truncate text-[12px] text-brand-text-muted">
                          {line.note}
                        </p>
                      ) : null}
                    </div>
                    {line.editable ? (
                      <CartQtyStepper
                        qty={line.qty}
                        disabled={busyLineId === line.lineId || sendBusy}
                        onDecrement={() => onOwnLineQtyChange(line.lineId, line.qty - 1)}
                        onIncrement={() => onOwnLineQtyChange(line.lineId, line.qty + 1)}
                      />
                    ) : (
                      <span className="shrink-0 min-w-[1.25rem] text-center text-base font-semibold tabular-nums text-brand-text">
                        {line.qty}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </CustomerMenuBottomSheet>
  );
}
