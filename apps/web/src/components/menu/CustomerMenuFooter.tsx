import type { ReactNode } from 'react';
import Link from 'next/link';
import { CustomerCartIcon, CustomerOrderedBagIcon } from '@/components/menu/customer-ordering-icons';
import {
  customerMenuBottomBarActionSlotClass,
  customerMenuBottomBarDisabledActionClass,
  customerMenuBottomBarDockClass,
  customerMenuBottomBarIconClass,
  customerMenuBottomBarIconGapClass,
  customerMenuBottomBarPrimaryActionClass,
  customerMenuBottomBarRowClass,
  customerMenuBottomBarSummarySlotClass,
} from '@/lib/customer-menu-bottom-bar-layout';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import type { MenuPageFooterPhase, MenuPageFooterPrimaryAction, MenuPageFooterView } from '@/lib/menu-page-footer';

type Labels = {
  viewCart: string;
  viewBill: string;
  viewOrdered: string;
  placeOrder: string;
  footerTotal: string;
  orderedCount: (count: number) => string;
};

type Props = MenuPageFooterView & {
  labels: Labels;
  onOpenCart: () => void;
  onOpenOrdered: () => void;
};

function FooterAmount({ totalLabel, amount }: { totalLabel: string; amount: number }) {
  return (
    <span className="flex shrink-0 items-baseline gap-1">
      <span className={CUSTOMER_MENU_TYPE.footerAmountLabel}>{totalLabel}</span>
      <span className={CUSTOMER_MENU_TYPE.moneyAmount}>€{amount.toFixed(2)}</span>
    </span>
  );
}

function FooterBarShell({
  summary,
  action,
}: {
  summary: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className={customerMenuBottomBarDockClass}>
      <div className={customerMenuBottomBarRowClass}>
        <div className={customerMenuBottomBarSummarySlotClass}>{summary}</div>
        {action ? <div className={customerMenuBottomBarActionSlotClass}>{action}</div> : null}
      </div>
    </div>
  );
}

function DraftSummary({
  cartQty,
  cartTotal,
  totalLabel,
  viewCartLabel,
  onOpenCart,
}: {
  cartQty: number;
  cartTotal: number;
  totalLabel: string;
  viewCartLabel: string;
  onOpenCart: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpenCart}
      className={`flex min-w-0 flex-1 items-center ${customerMenuBottomBarIconGapClass} text-left transition-colors hover:bg-brand-gold/5 active:bg-brand-gold/10`}
      aria-label={viewCartLabel}
    >
      <span className="relative shrink-0 text-brand-gold">
        <CustomerCartIcon className={customerMenuBottomBarIconClass} />
        {cartQty > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold leading-none text-brand-on-gold">
            {cartQty}
          </span>
        ) : null}
      </span>
      {cartQty > 0 ? (
        <FooterAmount totalLabel={totalLabel} amount={cartTotal} />
      ) : (
        <span className={CUSTOMER_MENU_TYPE.footerHint}>{viewCartLabel}</span>
      )}
    </button>
  );
}

function OrderedSummary({
  submittedTotal,
  totalLabel,
  orderedCountLabel,
}: {
  submittedTotal: number;
  totalLabel: string;
  orderedCountLabel: string;
}) {
  return (
    <div className={`flex min-w-0 flex-1 items-center ${customerMenuBottomBarIconGapClass}`}>
      <CustomerOrderedBagIcon className={customerMenuBottomBarIconClass} />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={CUSTOMER_MENU_TYPE.footerSummary}>{orderedCountLabel}</span>
        <FooterAmount totalLabel={totalLabel} amount={submittedTotal} />
      </div>
    </div>
  );
}

function IdleSummary({
  viewCartLabel,
  onOpenCart,
}: {
  viewCartLabel: string;
  onOpenCart: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpenCart}
      className={`flex min-w-0 flex-1 items-center ${customerMenuBottomBarIconGapClass} text-left transition-colors hover:bg-brand-gold/5 active:bg-brand-gold/10`}
      aria-label={viewCartLabel}
    >
      <CustomerCartIcon className={customerMenuBottomBarIconClass} />
      <span className={CUSTOMER_MENU_TYPE.footerHint}>{viewCartLabel}</span>
    </button>
  );
}

function FooterPrimaryAction({
  primaryAction,
  labels,
  billHref,
  billEnabled,
  onOpenCart,
  onOpenOrdered,
}: {
  primaryAction: MenuPageFooterPrimaryAction;
  labels: Pick<Labels, 'placeOrder' | 'viewOrdered' | 'viewBill'>;
  billHref: string;
  billEnabled: boolean;
  onOpenCart: () => void;
  onOpenOrdered: () => void;
}) {
  switch (primaryAction) {
    case 'openCart':
      return (
        <button type="button" onClick={onOpenCart} className={customerMenuBottomBarPrimaryActionClass}>
          {labels.placeOrder}
        </button>
      );
    case 'viewOrdered':
      return (
        <button type="button" onClick={onOpenOrdered} className={customerMenuBottomBarPrimaryActionClass}>
          {labels.viewOrdered}
        </button>
      );
    case 'viewBill':
      return billEnabled ? (
        <Link href={billHref} className={customerMenuBottomBarPrimaryActionClass}>
          {labels.viewBill}
        </Link>
      ) : (
        <span aria-disabled="true" className={customerMenuBottomBarDisabledActionClass}>
          {labels.viewBill}
        </span>
      );
    default:
      return null;
  }
}

function footerSummaryForPhase(
  phase: MenuPageFooterPhase,
  props: Props,
): ReactNode {
  switch (phase) {
    case 'draft':
      return (
        <DraftSummary
          cartQty={props.cartQty}
          cartTotal={props.cartTotal}
          totalLabel={props.labels.footerTotal}
          viewCartLabel={props.labels.viewCart}
          onOpenCart={props.onOpenCart}
        />
      );
    case 'ordered':
      return (
        <OrderedSummary
          submittedTotal={props.submittedTotal}
          totalLabel={props.labels.footerTotal}
          orderedCountLabel={props.labels.orderedCount(props.submittedCount)}
        />
      );
    default:
      return <IdleSummary viewCartLabel={props.labels.viewCart} onOpenCart={props.onOpenCart} />;
  }
}

export function CustomerMenuFooter(props: Props) {
  const { visible, phase, primaryAction, billHref, billEnabled, labels, onOpenCart, onOpenOrdered } =
    props;

  if (!visible) return null;

  return (
    <FooterBarShell
      summary={footerSummaryForPhase(phase, props)}
      action={
        <FooterPrimaryAction
          primaryAction={primaryAction}
          labels={labels}
          billHref={billHref}
          billEnabled={billEnabled}
          onOpenCart={onOpenCart}
          onOpenOrdered={onOpenOrdered}
        />
      }
    />
  );
}
