import Link from 'next/link';
import { CustomerCartIcon, CustomerOrderedBagIcon } from '@/components/menu/customer-ordering-icons';
import {
  customerMenuBottomBarDockClass,
  customerMenuBottomBarRowClass,
} from '@/lib/customer-menu-bottom-bar-layout';
import type { MenuPageFooterView } from '@/lib/menu-page-footer';

type Labels = {
  viewCart: string;
  viewBill: string;
  viewOrdered: string;
  placeOrder: string;
  orderedCount: (count: number) => string;
};

type Props = MenuPageFooterView & {
  labels: Labels;
  onOpenCart: () => void;
  onOpenOrdered: () => void;
};

const summaryZoneClassName = 'flex min-w-0 items-center gap-2.5 text-left';

const actionButtonClassName =
  'inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-4 text-[14px] font-semibold transition-colors';

const primaryActionButtonClassName = `${actionButtonClassName} bg-brand-gold text-brand-on-gold hover:bg-brand-gold-light active:scale-[0.98]`;

export function CustomerMenuFooter({
  visible,
  phase,
  primaryAction,
  cartQty,
  cartTotal,
  submittedCount,
  billHref,
  billEnabled,
  labels,
  onOpenCart,
  onOpenOrdered,
}: Props) {
  if (!visible) return null;

  const billLink = billEnabled ? (
    <Link href={billHref} className={primaryActionButtonClassName}>
      {labels.viewBill}
    </Link>
  ) : (
    <span
      aria-disabled="true"
      className={`${actionButtonClassName} pointer-events-none bg-brand-border/20 text-brand-text-muted`}
    >
      {labels.viewBill}
    </span>
  );

  const primaryActionNode = (() => {
    switch (primaryAction) {
      case 'openCart':
        return (
          <button type="button" onClick={onOpenCart} className={primaryActionButtonClassName}>
            {labels.placeOrder}
          </button>
        );
      case 'viewOrdered':
        return (
          <button type="button" onClick={onOpenOrdered} className={primaryActionButtonClassName}>
            {labels.viewOrdered}
          </button>
        );
      case 'viewBill':
        return billLink;
      default:
        return null;
    }
  })();

  const summaryNode =
    phase === 'ordered' ? (
      <div className={summaryZoneClassName}>
        <CustomerOrderedBagIcon className="h-6 w-6 shrink-0 text-brand-gold" />
        <span className="truncate font-heading text-lg font-semibold text-brand-text">
          {labels.orderedCount(submittedCount)}
        </span>
      </div>
    ) : (
      <button
        type="button"
        onClick={onOpenCart}
        className={`${summaryZoneClassName} transition-colors hover:bg-brand-gold/5 active:bg-brand-gold/10`}
        aria-label={labels.viewCart}
      >
        <span className="relative shrink-0 text-brand-gold">
          <CustomerCartIcon className="h-6 w-6" />
          {cartQty > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold leading-none text-brand-on-gold">
              {cartQty}
            </span>
          ) : null}
        </span>
        {cartQty > 0 ? (
          <span className="truncate font-heading text-lg font-semibold tabular-nums text-brand-text">
            €{cartTotal.toFixed(2)}
          </span>
        ) : (
          <span className="truncate text-sm text-brand-text-muted">{labels.viewCart}</span>
        )}
      </button>
    );

  return (
    <div className={customerMenuBottomBarDockClass}>
      <div className={customerMenuBottomBarRowClass}>
        {summaryNode}
        {primaryActionNode}
      </div>
    </div>
  );
}
