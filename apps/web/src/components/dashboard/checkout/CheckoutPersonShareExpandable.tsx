'use client';

import { useState, type ReactNode } from 'react';
import type { CheckoutPersonShareLine } from '@/lib/checkout-split-person-lines';

type ShareLabels = {
  expand: string;
  collapse: string;
  empty: string;
};

type Props = {
  canExpand: boolean;
  shareLines: CheckoutPersonShareLine[];
  labels: ShareLabels;
  /** Person name (+ optional owed subtitle). */
  identity: ReactNode;
  /** Amount + action button(s). */
  trailing: ReactNode;
  className?: string;
};

/** Shared pending/collected row: optional by_item dish-share toggle. */
export function CheckoutPersonShareExpandable({
  canExpand,
  shareLines,
  labels,
  identity,
  trailing,
  className = '',
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const showPanel = canExpand && expanded;

  return (
    <div className={className || undefined}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="min-w-0 flex items-start gap-1.5">
          {canExpand ? (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="mt-0.5 shrink-0 w-5 h-5 flex items-center justify-center text-brand-text-muted hover:text-brand-text transition-colors"
              aria-expanded={expanded}
              aria-label={expanded ? labels.collapse : labels.expand}
            >
              <span aria-hidden>{expanded ? '▾' : '▸'}</span>
            </button>
          ) : null}
          {canExpand ? (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="min-w-0 text-left hover:opacity-80 transition-opacity"
            >
              {identity}
            </button>
          ) : (
            <div className="min-w-0">{identity}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">{trailing}</div>
      </div>
      {showPanel ? (
        <div className="mt-2 ml-6 rounded-md border border-brand-border/50 bg-brand-card/80 overflow-hidden">
          {shareLines.length === 0 ? (
            <p className="text-brand-text-muted text-[12px] px-3 py-2">{labels.empty}</p>
          ) : (
            shareLines.map((line) => (
              <div
                key={line.key}
                className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-brand-border/40 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                  <span className="text-brand-text text-[13px] font-medium truncate">{line.label || '—'}</span>
                  <span className="text-brand-text text-[12px] tabular-nums">{line.quantityLabel}</span>
                </div>
                <span className="text-brand-text text-[13px] tabular-nums shrink-0">
                  €{line.shareAmount.toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
