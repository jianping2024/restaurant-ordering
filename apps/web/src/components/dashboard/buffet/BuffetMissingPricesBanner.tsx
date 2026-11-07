'use client';

import type { BuffetMissingPriceCell } from '@/lib/buffet-pricing-admin';
import type { Buffet, BuffetCalendarKind, BuffetTimeSlot } from '@/types';

type Props = {
  cells: BuffetMissingPriceCell[];
  buffets: Array<Pick<Buffet, 'id' | 'name'>>;
  slots: Array<Pick<BuffetTimeSlot, 'id' | 'name'>>;
  dayKindLabel: (kind: BuffetCalendarKind) => string;
  title: string;
  actionLabel: string;
  /** Kind-list joiner (zh「、」, others ", "). */
  listSeparator: string;
  onGoToPriceGrid: (buffetId: string) => void;
};

/**
 * Sole「自助餐定价」top alert: buffet × slot × calendar kinds with no price today.
 * Renders nothing once every cell is filled.
 */
export function BuffetMissingPricesBanner({
  cells,
  buffets,
  slots,
  dayKindLabel,
  title,
  actionLabel,
  listSeparator,
  onGoToPriceGrid,
}: Props) {
  if (cells.length === 0) return null;
  const nameOfBuffet = (id: string) => buffets.find((b) => b.id === id)?.name ?? id;
  const nameOfSlot = (id: string) => slots.find((s) => s.id === id)?.name ?? id;
  const byBuffet = new Map<string, BuffetMissingPriceCell[]>();
  for (const cell of cells) {
    byBuffet.set(cell.buffetId, [...(byBuffet.get(cell.buffetId) ?? []), cell]);
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border-2 border-status-danger/70 bg-status-danger/10 px-4 py-3 sm:flex-row sm:items-start"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[15px] font-semibold mesa-text-danger">{title}</p>
        <ul className="space-y-1 text-[13px] leading-relaxed text-brand-text">
          {Array.from(byBuffet.entries()).map(([buffetId, rows]) => (
            <li key={buffetId}>
              <strong>{nameOfBuffet(buffetId)}</strong>
              {rows.map((row) => (
                <span key={row.slotId}>
                  {' · '}
                  {nameOfSlot(row.slotId)}：{row.kinds.map(dayKindLabel).join(listSeparator)}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => onGoToPriceGrid(cells[0]!.buffetId)}
        className="min-h-[44px] shrink-0 rounded-lg bg-brand-text px-4 text-sm font-semibold text-brand-bg"
      >
        {actionLabel}
      </button>
    </div>
  );
}
