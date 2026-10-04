import type { ReactNode } from 'react';
import Link from 'next/link';
import { CustomerCartIcon, CustomerOrderedBagIcon } from '@/components/menu/customer-ordering-icons';
import {
  customerMenuBottomBarActionSlotClass,
  customerMenuBottomBarCountBadgeClass,
  customerMenuBottomBarDisabledActionClass,
  customerMenuBottomBarDockClass,
  customerMenuBottomBarIconBoxClass,
  customerMenuBottomBarIconClass,
  customerMenuBottomBarIconGapClass,
  customerMenuBottomBarIconPopClass,
  customerMenuBottomBarPrimaryActionClass,
  customerMenuBottomBarRowClass,
  customerMenuBottomBarSuccessActionClass,
  customerMenuBottomBarSummarySlotClass,
  formatCustomerMenuFooterBadgeCount,
} from '@/lib/customer-menu-bottom-bar-layout';
import type { CustomerMenuSubmitFeedback } from '@/lib/customer-menu-submit-feedback';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import type { MenuPageFooterPhase, MenuPageFooterPrimaryAction, MenuPageFooterView } from '@/lib/menu-page-footer';

type Labels = {
  viewCart: string;
  viewBill: string;
  viewOrdered: string;
  viewRoundReview?: string;
  roundReviewCount?: (count: number) => string;
  placeOrder: string;
  footerTotal: string;
  orderedCount: (count: number) => string;
};

type Props = MenuPageFooterView & {
  labels: Labels;
  onOpenCart: () => void;
  onOpenOrdered: () => void;
  onOpenRoundReview?: () => void;
  /** Sole add-to-cart feedback token; bump only when total cart qty rises. */
  cartAddFeedbackKey?: number;
  /** Sole submit success feedback (✓ pill + ordered badge pop) — not a toast. */
  submitFeedback?: CustomerMenuSubmitFeedback | null;
};

function FooterAmount({ totalLabel, amount }: { totalLabel: string; amount: number }) {
  return (
    <span className="flex min-w-0 shrink items-baseline gap-1">
      <span className={CUSTOMER_MENU_TYPE.footerAmountLabel}>{totalLabel}</span>
      <span className={`${CUSTOMER_MENU_TYPE.moneyAmount} truncate`}>€{amount.toFixed(2)}</span>
    </span>
  );
}

/** Sole qty badge on footer icons — count via {@link formatCustomerMenuFooterBadgeCount}. */
function FooterIconCountBadge({ count }: { count: number }) {
  const label = formatCustomerMenuFooterBadgeCount(count);
  if (!label) return null;
  return <span className={customerMenuBottomBarCountBadgeClass}>{label}</span>;
}

/** Sole footer icon slot: 44×44 box, icon bottom-left, badge top-right inside. */
function FooterIconSlot({
  icon,
  count,
  popKey = 0,
  className = '',
}: {
  icon: ReactNode;
  count: number;
  /** Bump to replay the badge pop (cart add / submit success). */
  popKey?: number;
  className?: string;
}) {
  return (
    <span
      key={popKey}
      className={`${customerMenuBottomBarIconBoxClass} ${
        popKey > 0 ? customerMenuBottomBarIconPopClass : ''
      } ${className}`}
    >
      {icon}
      <FooterIconCountBadge count={count} />
    </span>
  );
}

function FooterBarShell({
  summary,
  action,
  liveMessage,
}: {
  summary: ReactNode;
  action: ReactNode;
  /** Persistent polite live region — submit success is announced, not toasted. */
  liveMessage: string;
}) {
  return (
    <div className={customerMenuBottomBarDockClass} data-mesa-bottom-dock="">
      <span className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </span>
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
  cartAddFeedbackKey,
  onOpenCart,
}: {
  cartQty: number;
  cartTotal: number;
  totalLabel: string;
  viewCartLabel: string;
  cartAddFeedbackKey: number;
  onOpenCart: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpenCart}
      className={`flex min-w-0 flex-1 items-center ${customerMenuBottomBarIconGapClass} text-left transition-colors hover:bg-brand-gold/5 active:bg-brand-gold/10`}
      aria-label={viewCartLabel}
    >
      <FooterIconSlot
        icon={<CustomerCartIcon className={customerMenuBottomBarIconClass} />}
        count={cartQty}
        popKey={cartAddFeedbackKey}
        className="text-brand-gold"
      />
      {cartQty > 0 ? (
        <FooterAmount totalLabel={totalLabel} amount={cartTotal} />
      ) : (
        <span className={CUSTOMER_MENU_TYPE.footerHint}>{viewCartLabel}</span>
      )}
    </button>
  );
}

function OrderedSummary({
  submittedCount,
  submittedTotal,
  totalLabel,
  orderedCountLabel,
  submitPopKey,
}: {
  submittedCount: number;
  submittedTotal: number;
  totalLabel: string;
  orderedCountLabel: string;
  submitPopKey: number;
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center ${customerMenuBottomBarIconGapClass}`}
      aria-label={orderedCountLabel}
    >
      <FooterIconSlot
        icon={<CustomerOrderedBagIcon className={customerMenuBottomBarIconClass} />}
        count={submittedCount}
        popKey={submitPopKey}
      />
      <FooterAmount totalLabel={totalLabel} amount={submittedTotal} />
    </div>
  );
}

function RoundReviewSummary({
  roundOwnQty,
  roundReviewCountLabel,
  viewRoundReviewLabel,
  submittedCount,
  orderedCountLabel,
  onOpenRoundReview,
  onOpenOrdered,
  submitPopKey,
}: {
  roundOwnQty: number;
  roundReviewCountLabel: string;
  viewRoundReviewLabel: string;
  submittedCount: number;
  orderedCountLabel: string;
  onOpenRoundReview: () => void;
  onOpenOrdered: () => void;
  submitPopKey: number;
}) {
  return (
    <div className={`flex min-w-0 flex-1 items-center ${customerMenuBottomBarIconGapClass}`}>
      <button
        type="button"
        onClick={onOpenRoundReview}
        className={`flex min-w-0 items-center ${customerMenuBottomBarIconGapClass} text-left transition-colors hover:bg-brand-gold/5 active:bg-brand-gold/10`}
        aria-label={viewRoundReviewLabel}
      >
        <FooterIconSlot
          icon={<CustomerCartIcon className={customerMenuBottomBarIconClass} />}
          count={roundOwnQty}
        />
        <span className="sr-only">{roundReviewCountLabel}</span>
      </button>
      {submittedCount > 0 ? (
        <button
          type="button"
          onClick={onOpenOrdered}
          className={`flex shrink-0 items-center text-left text-brand-text-muted transition-colors hover:bg-brand-gold/5`}
          aria-label={orderedCountLabel}
        >
          <FooterIconSlot
            icon={<CustomerOrderedBagIcon className={customerMenuBottomBarIconClass} />}
            count={submittedCount}
            popKey={submitPopKey}
          />
        </button>
      ) : (
        <span className="sr-only">{roundOwnQty}</span>
      )}
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
      <FooterIconSlot
        icon={<CustomerCartIcon className={customerMenuBottomBarIconClass} />}
        count={0}
      />
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
  onOpenRoundReview,
}: {
  primaryAction: MenuPageFooterPrimaryAction;
  labels: Pick<Labels, 'placeOrder' | 'viewOrdered' | 'viewBill' | 'viewRoundReview'>;
  billHref: string;
  billEnabled: boolean;
  onOpenCart: () => void;
  onOpenOrdered: () => void;
  onOpenRoundReview?: () => void;
}) {
  switch (primaryAction) {
    case 'openCart':
      return (
        <button type="button" onClick={onOpenCart} className={customerMenuBottomBarPrimaryActionClass}>
          {labels.placeOrder}
        </button>
      );
    case 'openRoundReview':
      return onOpenRoundReview ? (
        <button
          type="button"
          onClick={onOpenRoundReview}
          className={customerMenuBottomBarPrimaryActionClass}
        >
          {labels.viewRoundReview ?? labels.viewOrdered}
        </button>
      ) : null;
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
          cartAddFeedbackKey={props.cartAddFeedbackKey ?? 0}
          onOpenCart={props.onOpenCart}
        />
      );
    case 'roundReview':
      return props.onOpenRoundReview ? (
        <RoundReviewSummary
          roundOwnQty={props.roundOwnQty}
          roundReviewCountLabel={(props.labels.roundReviewCount ?? props.labels.orderedCount)(
            props.roundOwnQty,
          )}
          viewRoundReviewLabel={props.labels.viewRoundReview ?? props.labels.viewOrdered}
          submittedCount={props.submittedCount}
          orderedCountLabel={props.labels.orderedCount(props.submittedCount)}
          onOpenRoundReview={props.onOpenRoundReview}
          onOpenOrdered={props.onOpenOrdered}
          submitPopKey={props.submitFeedback?.key ?? 0}
        />
      ) : (
        <IdleSummary viewCartLabel={props.labels.viewCart} onOpenCart={props.onOpenCart} />
      );
    case 'ordered':
      return (
        <OrderedSummary
          submittedCount={props.submittedCount}
          submittedTotal={props.submittedTotal}
          totalLabel={props.labels.footerTotal}
          orderedCountLabel={props.labels.orderedCount(props.submittedCount)}
          submitPopKey={props.submitFeedback?.key ?? 0}
        />
      );
    default:
      return <IdleSummary viewCartLabel={props.labels.viewCart} onOpenCart={props.onOpenCart} />;
  }
}

export function CustomerMenuFooter(props: Props) {
  const {
    visible,
    phase,
    primaryAction,
    billHref,
    billEnabled,
    labels,
    onOpenCart,
    onOpenOrdered,
    onOpenRoundReview,
    submitFeedback,
  } = props;

  if (!visible) return null;

  return (
    <FooterBarShell
      summary={footerSummaryForPhase(phase, props)}
      action={
        submitFeedback ? (
          <span className={customerMenuBottomBarSuccessActionClass} aria-hidden>
            <span className="shrink-0">✓</span>
            <span className="truncate">{submitFeedback.message}</span>
          </span>
        ) : (
          <FooterPrimaryAction
            primaryAction={primaryAction}
            labels={labels}
            billHref={billHref}
            billEnabled={billEnabled}
            onOpenCart={onOpenCart}
            onOpenOrdered={onOpenOrdered}
            onOpenRoundReview={onOpenRoundReview}
          />
        )
      }
      liveMessage={submitFeedback?.message ?? ''}
    />
  );
}
