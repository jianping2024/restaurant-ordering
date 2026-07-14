import type { CustomerSplitRowDisplay } from '@/lib/customer-bill-split-display';
import { splitRowDisplayAmount } from '@/lib/customer-bill-split-display';

export type SplitSettlementCopy = {
  splitPaid: string;
  splitPartialPaid: string;
  splitAmountBreakdown: string;
};

type RowProps = {
  row: CustomerSplitRowDisplay;
  copy: SplitSettlementCopy;
};

/** Inline paid / partial badges for one split row. */
export function SplitSettlementStatusBadges({ row, copy }: RowProps) {
  if (row.settlementStatus === 'settled') {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full mesa-badge-success">{copy.splitPaid}</span>
    );
  }
  if (row.settlementStatus === 'partial') {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full border border-brand-gold/40 text-brand-gold">
        {copy.splitPartialPaid}
      </span>
    );
  }
  return null;
}

export function SplitSettlementPartialBreakdown({ row, copy }: RowProps) {
  if (row.settlementStatus !== 'partial') return null;
  return (
    <p className="mt-1 text-[12px] text-brand-text-muted">
      {copy.splitAmountBreakdown
        .replace('{obligation}', row.obligationAmount.toFixed(2))
        .replace('{collected}', row.collectedAmount.toFixed(2))}
    </p>
  );
}

export function SplitSettlementAmount({ row }: { row: CustomerSplitRowDisplay }) {
  return (
    <span className="font-heading text-brand-gold font-medium shrink-0">
      €{splitRowDisplayAmount(row).toFixed(2)}
    </span>
  );
}

export function splitRowShowsSettlement(row: CustomerSplitRowDisplay): boolean {
  return row.settlementStatus !== 'due';
}
