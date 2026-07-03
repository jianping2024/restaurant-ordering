'use client';

import type { ByItemLineStatusTone } from '@/lib/bill-split-by-item';

type Props = {
  statusTone: ByItemLineStatusTone;
  readOnly?: boolean;
  expanded: boolean;
  header: React.ReactNode;
  children: React.ReactNode;
};

export function ByItemDishAllocatorShell({
  statusTone,
  readOnly = false,
  expanded,
  header,
  children,
}: Props) {
  return (
    <div
      className={`bg-brand-card border rounded-xl p-3.5 ${
        statusTone === 'alert'
          ? 'border-red-500/40 ring-1 ring-red-500/20'
          : 'border-brand-border'
      }${readOnly ? ' opacity-60 pointer-events-none' : ''}`}
    >
      {header}
      {expanded ? children : null}
    </div>
  );
}
