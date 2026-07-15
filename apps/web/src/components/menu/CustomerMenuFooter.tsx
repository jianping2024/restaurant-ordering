import Link from 'next/link';
import { CustomerCartIcon } from '@/components/menu/customer-ordering-icons';
import type { MenuPageFooterView } from '@/lib/menu-page-footer';

type Labels = {
  viewCart: string;
  viewBill: string;
};

type Props = MenuPageFooterView & {
  labels: Labels;
  onOpenCart: () => void;
};

const billButtonClassName =
  'inline-flex h-full shrink-0 items-center justify-center px-4 text-[14px] font-semibold transition-colors';

export function CustomerMenuFooter({
  visible,
  cartQty,
  cartTotal,
  billHref,
  billEnabled,
  showBillCta,
  labels,
  onOpenCart,
}: Props) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-30 w-full max-w-mobile -translate-x-1/2 px-4 pb-[max(0px,env(safe-area-inset-bottom))]">
      <div className="flex h-14 items-stretch overflow-hidden rounded-2xl border border-brand-border bg-brand-card shadow-xl shadow-black/10">
        <button
          type="button"
          onClick={onOpenCart}
          className="flex min-w-0 flex-1 items-center gap-2.5 px-4 text-left transition-colors hover:bg-brand-gold/5 active:bg-brand-gold/10"
          aria-label={labels.viewCart}
        >
          <span className="relative shrink-0 text-brand-gold">
            <CustomerCartIcon className="h-5 w-5" />
            {cartQty > 0 ? (
              <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold leading-none text-brand-on-gold">
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

        {showBillCta ? (
          <>
            <div className="w-px shrink-0 bg-brand-border" aria-hidden />
            {billEnabled ? (
              <Link
                href={billHref}
                className={`${billButtonClassName} bg-brand-gold text-brand-on-gold hover:bg-brand-gold-light active:scale-[0.98]`}
              >
                {labels.viewBill}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className={`${billButtonClassName} pointer-events-none bg-brand-border/20 text-brand-text-muted`}
              >
                {labels.viewBill}
              </span>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
