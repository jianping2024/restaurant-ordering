'use client';

import { useState } from 'react';
import type { CheckoutDisplayLine } from '@/lib/checkout-session-lines';

type Labels = {
  orderItemsCount: string;
  orderItemsEmpty: string;
  orderItemsTotal: string;
};

type Props = {
  lines: CheckoutDisplayLine[];
  total: number;
  labels: Labels;
  className?: string;
};

export function CheckoutTableItemsSection({ lines, total, labels, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-lg border border-brand-border/60 overflow-hidden${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left text-[13px] text-brand-text-muted hover:bg-brand-border/20 transition-colors"
      >
        <span>{labels.orderItemsCount.replace('{n}', String(lines.length))}</span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        lines.length === 0 ? (
          <p className="text-brand-text-muted text-sm px-3 pb-3">{labels.orderItemsEmpty}</p>
        ) : (
          <div className="border-t border-brand-border/60">
            {lines.map((line) => (
              <div
                key={line.key}
                className="flex items-center justify-between gap-2 px-3 py-2 border-b border-brand-border/40 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                  <span className="text-brand-text text-sm font-medium truncate">
                    {line.label || '—'}
                  </span>
                  <span className="text-brand-text text-[13px] tabular-nums">
                    {line.quantityLabel}
                  </span>
                </div>
                <span className="text-brand-text text-sm font-semibold tabular-nums shrink-0">
                  €{line.lineTotal.toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2 bg-brand-border/25 text-sm">
              <span className="text-brand-text font-medium">{labels.orderItemsTotal}</span>
              <span className="text-brand-text font-semibold tabular-nums">€{total.toFixed(2)}</span>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
