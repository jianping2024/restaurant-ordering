'use client';

import { Button } from '@/components/ui/Button';
import { WAITER_BOARD_PARTY_PANEL_CLASS, waiterBoardType } from '@/lib/waiter-board-card-theme';
import type { WaiterBoardPartyLane } from '@/lib/waiter-board-party-lanes';

type Props = {
  parties: readonly WaiterBoardPartyLane[];
  title: string;
  createLabel: string;
  emptyLabel: string;
  canCreate: boolean;
  createDisabled: boolean;
  busy: boolean;
  /** Sole row/lane meta — already `{n} 桌` or `{n} 桌 · A… C…`. */
  countLabelForLane: (lane: WaiterBoardPartyLane) => string;
  onCreate: () => void;
  onSelectParty: (partyId: string) => void;
};

/**
 * Together-groups list under the 同行组 lane tab (replaces the former dropdown menu).
 * Create lives here; tapping a row opens the existing party detail panel.
 */
export function WaiterBoardPartyListPage({
  parties,
  title,
  createLabel,
  emptyLabel,
  canCreate,
  createDisabled,
  busy,
  countLabelForLane,
  onCreate,
  onSelectParty,
}: Props) {
  return (
    <section className={`${WAITER_BOARD_PARTY_PANEL_CLASS} mb-6`} aria-label={title}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-brand-text">{title}</h2>
        {canCreate ? (
          <Button
            type="button"
            variant="gold"
            size="sm"
            disabled={createDisabled || busy}
            loading={busy}
            onClick={onCreate}
          >
            {createLabel}
          </Button>
        ) : null}
      </div>

      {parties.length === 0 ? (
        <p className="text-sm text-brand-text-muted">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-brand-border/60 overflow-hidden rounded-xl border border-brand-border/70 bg-brand-bg/40">
          {parties.map((lane) => {
            const countLabel = countLabelForLane(lane);
            return (
              <li key={lane.party.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelectParty(lane.party.id)}
                  className="flex w-full min-h-[3.25rem] items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-brand-gold/10 disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 text-sm font-medium text-brand-text">
                    {lane.party.name}
                  </span>
                  <span className={`${waiterBoardType.laneMeta} text-brand-text-muted`}>
                    {countLabel}
                  </span>
                  <span aria-hidden className="text-brand-text-muted/70 text-sm">
                    ›
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
