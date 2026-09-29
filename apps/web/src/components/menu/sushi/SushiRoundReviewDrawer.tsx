'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CustomerMenuBottomSheet } from '@/components/menu/CustomerMenuBottomSheet';
import { CustomerOrderedItemsList } from '@/components/menu/CustomerOrderedItemsList';
import type { CustomerSubmittedOrderGroup } from '@/lib/customer-submitted-order-display';

type Labels = {
  title: string;
  empty: string;
  continueOrdering: string;
  sendRound: string;
  countdownBanner: string;
};

type Props = {
  open: boolean;
  groups: CustomerSubmittedOrderGroup[];
  labels: Labels;
  canSend: boolean;
  sendBusy: boolean;
  /** Countdown active — show banner; send button disabled. */
  countdownActive: boolean;
  countdownSeconds: number;
  onClose: () => void;
  onSend: () => void;
};

export function SushiRoundReviewDrawer({
  open,
  groups,
  labels,
  canSend,
  sendBusy,
  countdownActive,
  countdownSeconds,
  onClose,
  onSend,
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
      <CustomerOrderedItemsList groups={groups} emptyLabel={labels.empty} />
    </CustomerMenuBottomSheet>
  );
}
