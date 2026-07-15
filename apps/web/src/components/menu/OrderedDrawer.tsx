'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import type { Order } from '@/types';
import { Button } from '@/components/ui/Button';
import { CustomerOrderedItemsList } from '@/components/menu/CustomerOrderedItemsList';
import { buildCustomerSubmittedDisplayOrders } from '@/lib/customer-submitted-order-display';
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
  labels,
  billHref,
  billEnabled,
  showBillLink,
  onClose,
}: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const groups = useMemo(
    () => (open && sessionResolved ? buildCustomerSubmittedDisplayOrders(orders, lang) : []),
    [lang, open, orders, sessionResolved],
  );

  const showSubmittedHint = open && sessionResolved && groups.length > 0;

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={onClose}
        />
      ) : null}

      <div
        className={`
        fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile z-40
        bg-brand-card rounded-t-3xl border-t border-brand-border
        transition-transform duration-300 ease-out
        ${open ? 'translate-y-0' : 'translate-y-full'}
      `}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-brand-border rounded-full" />
        </div>

        <div className="px-5 py-3 border-b border-brand-border flex items-center justify-between">
          <h2 className="font-heading text-xl text-brand-gold">{labels.title}</h2>
          <button type="button" onClick={onClose} className="text-brand-text-muted hover:text-brand-text">
            ✕
          </button>
        </div>

        <div className="modal-scroll overflow-y-auto max-h-[60vh] px-5 py-4">
          {open ? (
            <CustomerOrderedItemsList
              groups={groups}
              emptyLabel={labels.empty}
              submittedHint={showSubmittedHint ? labels.submittedHint : undefined}
              loading={!sessionResolved}
            />
          ) : null}
        </div>

        <div className="px-5 py-4 border-t border-brand-border flex gap-3">
          <Button type="button" variant="outline" className="flex-1" size="lg" onClick={onClose}>
            {labels.continueOrdering}
          </Button>
          {showBillLink ? (
            billEnabled ? (
              <Link
                href={billHref}
                className="flex-1 inline-flex h-12 items-center justify-center rounded-xl bg-brand-gold px-4 text-[15px] font-semibold text-brand-on-gold hover:bg-brand-gold-light active:scale-[0.98] transition-colors"
              >
                {labels.viewBill}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="flex-1 inline-flex h-12 items-center justify-center rounded-xl bg-brand-border/20 px-4 text-[15px] font-semibold text-brand-text-muted pointer-events-none"
              >
                {labels.viewBill}
              </span>
            )
          ) : null}
        </div>
      </div>
    </>
  );
}
