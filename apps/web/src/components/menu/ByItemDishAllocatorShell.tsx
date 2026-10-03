'use client';

import type { ByItemLineStatusTone } from '@/lib/bill-split-by-item';

type Props = {
  lineKey: string;
  statusTone: ByItemLineStatusTone;
  expanded: boolean;
  header: React.ReactNode;
  children: React.ReactNode;
};

/** Sole guest by-item card chrome; `data-by-item-line-key` is the scroll target. */
export function ByItemDishAllocatorShell({
  lineKey,
  statusTone,
  expanded,
  header,
  children,
}: Props) {
  return (
    <div
      data-by-item-line-key={lineKey}
      className={`bg-brand-card border rounded-xl p-3.5 ${
        statusTone === 'alert'
          ? 'border-red-500/40 ring-1 ring-red-500/20'
          : 'border-brand-border'
      }`}
    >
      {header}
      {expanded ? children : null}
    </div>
  );
}
