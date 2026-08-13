'use client';

import { Button } from '@/components/ui/Button';
import { CustomerMenuBottomSheet } from '@/components/menu/CustomerMenuBottomSheet';
import { CustomerOrderedItemsList } from '@/components/menu/CustomerOrderedItemsList';
import type { CustomerSubmittedOrderGroup } from '@/lib/customer-submitted-order-display';

type Labels = {
  title: string;
  empty: string;
  continueOrdering: string;
  sendRound: string;
  lockedHint: string;
};

type Props = {
  open: boolean;
  groups: CustomerSubmittedOrderGroup[];
  labels: Labels;
  canSend: boolean;
  sendBusy: boolean;
  locked: boolean;
  onClose: () => void;
  onSend: () => void;
};

export function SushiRoundReviewDrawer({
  open,
  groups,
  labels,
  canSend,
  sendBusy,
  locked,
  onClose,
  onSend,
}: Props) {
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
            disabled={!canSend || sendBusy || locked}
            loading={sendBusy}
            onClick={onSend}
          >
            {labels.sendRound}
          </Button>
        </div>
      }
    >
      <CustomerOrderedItemsList
        groups={groups}
        emptyLabel={labels.empty}
        submittedHint={locked ? labels.lockedHint : undefined}
      />
    </CustomerMenuBottomSheet>
  );
}
