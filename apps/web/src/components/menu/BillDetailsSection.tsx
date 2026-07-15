'use client';

import type { CheckoutDisplayLine } from '@/lib/checkout-session-lines';

type Props = {
  title: string;
  totalLabel: string;
  lines: CheckoutDisplayLine[];
  total: number;
};

export function BillDetailsSection({ title, totalLabel, lines, total }: Props) {
  return (
    <div className="px-4 py-4">
      <h2 className="text-brand-text font-medium mb-3">{title}</h2>
      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        {lines.map((line) => (
          <div
            key={line.key}
            className="flex items-center justify-between px-4 py-3 border-b border-brand-border last:border-0 gap-2"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
              {line.emoji ? <span>{line.emoji}</span> : null}
              {line.itemCode ? (
                <span className="font-mono text-[11px] text-brand-gold tabular-nums shrink-0">
                  [{line.itemCode}]
                </span>
              ) : null}
              <span className="text-brand-text text-sm">{line.name}</span>
              <span className="text-brand-text-muted text-[13px]">{line.quantityLabel}</span>
            </div>
            <span className="text-brand-gold text-sm flex-shrink-0 tabular-nums">
              €{line.lineTotal.toFixed(2)}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3 bg-brand-border/30">
          <span className="text-brand-text font-medium">{totalLabel}</span>
          <span className="font-heading text-xl text-brand-gold tabular-nums">€{total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
