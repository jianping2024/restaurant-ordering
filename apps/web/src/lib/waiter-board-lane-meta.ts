import {
  formatBuffetHeadcountLabel,
  type BuffetGuestHeadcount,
} from '@/lib/buffet-order';
import {
  sumWaiterBoardDiningHeadcount,
  type WaiterBoardStateContext,
} from '@/lib/waiter-board-session';

/**
 * Sole lane / party-list meta: `{n} 桌` plus optional ` · A… C…`
 * (hide A/C when zero or when the caller withholds headcount).
 */
export function formatWaiterBoardLaneCountLabel(
  tableCountLabel: string,
  headcountLabel: string | null,
): string {
  if (!headcountLabel) return tableCountLabel;
  return `${tableCountLabel} · ${headcountLabel}`;
}

/** Dining A/C for a table set — null when gated off or all zeros. */
export function waiterBoardLaneHeadcountLabel(
  tableIds: readonly string[],
  ctx: WaiterBoardStateContext,
  headcountByTableId: ReadonlyMap<string, BuffetGuestHeadcount | null | undefined>,
  showHeadcount: boolean,
): string | null {
  if (!showHeadcount) return null;
  const sum = sumWaiterBoardDiningHeadcount(tableIds, ctx, headcountByTableId);
  const label = formatBuffetHeadcountLabel(sum.adults, sum.children);
  return label.length > 0 ? label : null;
}
