'use client';

import type { CheckoutDisplayLine } from '@/lib/checkout-session-lines';
import { chargeableShareOf } from '@/lib/billable-session-lines';

export type BillDetailsCollectionFooter = {
  collected: number;
  pending: number;
  /** Folded payable when discount applies; omit/null otherwise. */
  payable: number | null;
  payableLabel: string;
  collectedLabel: string;
  pendingLabel: string;
  /** Preformatted discount line; null when no discount. */
  discountLabel: string | null;
};

type Props = {
  title: string;
  totalLabel: string;
  lines: CheckoutDisplayLine[];
  total: number;
  /** Format chargeable qty hint; omit to hide. */
  formatChargeableHint?: (qty: number, unitPrice: number) => string;
  /** Sole under-合计 collection rows from {@link resolveGuestBillCollectionFooter}. */
  collectionFooter?: BillDetailsCollectionFooter | null;
};

export function BillDetailsSection({
  title,
  totalLabel,
  lines,
  total,
  formatChargeableHint,
  collectionFooter = null,
}: Props) {
  return (
    <div className="px-4 py-4">
      <h2 className="text-brand-text font-medium mb-3">{title}</h2>
      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        {lines.map((line) => {
          const share = chargeableShareOf(line);
          const chargeableHint =
            formatChargeableHint && share
              ? formatChargeableHint(share.qty, share.unitPrice)
              : null;
          return (
            <div
              key={line.key}
              className="flex items-center justify-between px-4 py-3 border-b border-brand-border last:border-0 gap-2"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="text-brand-text text-sm font-medium">{line.label}</span>
                  <span className="text-brand-text text-[13px] tabular-nums">{line.quantityLabel}</span>
                </div>
                {chargeableHint ? (
                  <span className="text-brand-text-muted text-xs">{chargeableHint}</span>
                ) : null}
              </div>
              <span className="text-brand-gold text-sm font-semibold flex-shrink-0 tabular-nums">
                €{line.lineTotal.toFixed(2)}
              </span>
            </div>
          );
        })}
        <div className="bg-brand-border/30">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-brand-text font-medium">{totalLabel}</span>
            <span className="mesa-money text-xl text-brand-gold">€{total.toFixed(2)}</span>
          </div>
          {collectionFooter ? (
            <div className="space-y-1 border-t border-brand-border/60 px-4 pb-3 pt-1.5">
              {collectionFooter.payable != null ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-brand-text-muted">{collectionFooter.payableLabel}</span>
                  <span className="text-brand-text tabular-nums font-medium">
                    €{collectionFooter.payable.toFixed(2)}
                  </span>
                </div>
              ) : null}
              {collectionFooter.discountLabel ? (
                <p className="text-[12px] text-brand-text-muted">{collectionFooter.discountLabel}</p>
              ) : null}
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-brand-text-muted">{collectionFooter.collectedLabel}</span>
                <span className="text-brand-text tabular-nums">
                  €{collectionFooter.collected.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-brand-text-muted">{collectionFooter.pendingLabel}</span>
                <span className="text-brand-gold font-semibold tabular-nums">
                  €{collectionFooter.pending.toFixed(2)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
