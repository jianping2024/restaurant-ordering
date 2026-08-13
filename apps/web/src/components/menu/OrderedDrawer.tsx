'use client';

import { useMemo } from 'react';
import type { Order } from '@/types';
import { Button, ButtonLink } from '@/components/ui/Button';
import { CustomerMenuBottomSheet } from '@/components/menu/CustomerMenuBottomSheet';
import { CustomerOrderedItemsList } from '@/components/menu/CustomerOrderedItemsList';
import { buildCustomerSubmittedDisplayOrders } from '@/lib/customer-submitted-order-display';
import type { CustomerKitchenProgress } from '@/lib/kitchen-progress-display';
import type { Language } from '@/types';

type Labels = {
  title: string;
  empty: string;
  submittedHint: string;
  continueOrdering: string;
  viewBill: string;
};

type Props = {
  open: boolean;
  orders: Order[];
  lang: Language;
  sessionResolved: boolean;
  kitchenProgress?: CustomerKitchenProgress | null;
  labels: Labels;
  billHref: string;
  billEnabled: boolean;
  showBillLink: boolean;
  onClose: () => void;
};

export function OrderedDrawer({
  open,
  orders,
  lang,
  sessionResolved,
  kitchenProgress = null,
  labels,
  billHref,
  billEnabled,
  showBillLink,
  onClose,
}: Props) {
  const groups = useMemo(
    () =>
      open && sessionResolved
        ? buildCustomerSubmittedDisplayOrders(orders, lang, { kitchenProgress })
        : [],
    [kitchenProgress, lang, open, orders, sessionResolved],
  );

  const showSubmittedHint = open && sessionResolved && groups.length > 0;

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
          {showBillLink ? (
            <ButtonLink
              href={billHref}
              variant="gold"
              size="action"
              className="min-w-0 flex-1 whitespace-nowrap"
              disabled={!billEnabled}
            >
              {labels.viewBill}
            </ButtonLink>
          ) : null}
        </div>
      }
    >
      <CustomerOrderedItemsList
        groups={groups}
        emptyLabel={labels.empty}
        submittedHint={showSubmittedHint ? labels.submittedHint : undefined}
        loading={!sessionResolved}
      />
    </CustomerMenuBottomSheet>
  );
}
