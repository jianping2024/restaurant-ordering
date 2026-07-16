'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import type { UILanguage } from '@/lib/i18n';
import { tableIdsEqual, type RestaurantTableRow } from '@/lib/restaurant-tables';
import {
  membersForParty,
  partyIdForTable,
  type TablePartyGroup,
  type TablePartyGroupMember,
} from '@/lib/table-party-groups';
import {
  addTablesToWaiterTableParty,
  createWaiterTableParty,
  dissolveWaiterTableParty,
  removeTableFromWaiterTableParty,
} from '@/lib/table-party-groups-client';
import { WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS } from '@/lib/waiter-board-card-layout';
import {
  classifyWaiterTableBoardState,
  type WaiterBoardFilter,
  type WaiterBoardStateContext,
  type WaiterTableSessionMeta,
} from '@/lib/waiter-board-session';
import {
  sortWaiterBoardTableSummaries,
  type WaiterBoardTableSummary,
} from '@/lib/waiter-board-snapshot';

type PartyTexts = (typeof WAITER_TEXT)[UILanguage];

type Props = {
  restaurantSlug: string;
  isDemo: boolean;
  t: PartyTexts;
  parties: TablePartyGroup[];
  partyMembers: TablePartyGroupMember[];
  tables: RestaurantTableRow[];
  summaryByTableId: Map<string, WaiterBoardTableSummary>;
  boardFilter: WaiterBoardFilter;
  boardStateContext: WaiterBoardStateContext;
  checkoutRequestedTableIds: string[];
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>;
  tableSearchTrimmed: string;
  tableMatchesSearch: (displayName: string, q: string) => boolean;
  onPartyStateChange: (next: {
    parties: TablePartyGroup[];
    partyMembers: TablePartyGroupMember[];
  }) => void;
  renderTableCard: (card: WaiterBoardTableSummary, pinned?: boolean) => ReactNode;
};

export function WaiterBoardPartySections({
  restaurantSlug,
  isDemo,
  t,
  parties,
  partyMembers,
  tables,
  summaryByTableId,
  boardFilter,
  boardStateContext,
  checkoutRequestedTableIds,
  sessionMetaByTableId,
  tableSearchTrimmed,
  tableMatchesSearch,
  onPartyStateChange,
  renderTableCard,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [addTarget, setAddTarget] = useState<TablePartyGroup | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingMove, setPendingMove] = useState<{
    partyId: string;
    tableIds: string[];
    labels: string[];
  } | null>(null);

  const displayNameById = useMemo(
    () => new Map(tables.map((row) => [row.id, row.display_name])),
    [tables],
  );

  const createParty = async () => {
    if (isDemo) {
      showToast(t.partyMarkerOnlyHint, 'info');
      return;
    }
    setBusy(true);
    try {
      const result = await createWaiterTableParty(restaurantSlug);
      if (!result.ok) {
        showToast(t.partyCreateFailed, 'error');
        return;
      }
      onPartyStateChange(result.data);
    } finally {
      setBusy(false);
    }
  };

  const dissolveParty = async (party: TablePartyGroup) => {
    if (isDemo) return;
    if (!window.confirm(t.partyDissolveConfirm)) return;
    setBusy(true);
    try {
      const result = await dissolveWaiterTableParty(restaurantSlug, party.id);
      if (!result.ok) {
        showToast(t.actionFailed, 'error');
        return;
      }
      onPartyStateChange(result.data);
    } finally {
      setBusy(false);
    }
  };

  const removeTable = async (partyId: string, tableId: string) => {
    if (isDemo) return;
    setBusy(true);
    try {
      const result = await removeTableFromWaiterTableParty(restaurantSlug, partyId, tableId);
      if (!result.ok) {
        showToast(t.actionFailed, 'error');
        return;
      }
      onPartyStateChange(result.data);
    } finally {
      setBusy(false);
    }
  };

  const submitAdd = async (partyId: string, tableIds: string[], confirmMove: boolean) => {
    setBusy(true);
    try {
      const result = await addTablesToWaiterTableParty(
        restaurantSlug,
        partyId,
        tableIds,
        confirmMove,
      );
      if (!result.ok) {
        if (result.status === 409 && result.conflicts?.length) {
          const labels = result.conflicts.map(
            (c) => displayNameById.get(c.table_id) ?? c.table_id.slice(0, 8),
          );
          setPendingMove({ partyId, tableIds, labels });
          return;
        }
        showToast(t.partyAddFailed, 'error');
        return;
      }
      onPartyStateChange(result.data);
      setAddTarget(null);
      setSelectedIds([]);
      setPendingMove(null);
    } finally {
      setBusy(false);
    }
  };

  const addCandidates = useMemo(() => {
    if (!addTarget) return [];
    return tables.filter((table) => partyIdForTable(partyMembers, table.id) !== addTarget.id);
  }, [addTarget, partyMembers, tables]);

  const visibleParties = parties
    .map((party) => {
      const memberIds = membersForParty(partyMembers, party.id).map((m) => m.table_id);
      let cards = memberIds
        .map((id) => summaryByTableId.get(id))
        .filter((card): card is WaiterBoardTableSummary => !!card);

      if (boardFilter !== 'all') {
        cards = cards.filter(
          (card) => classifyWaiterTableBoardState(card.tableId, boardStateContext) === boardFilter,
        );
      }
      if (tableSearchTrimmed) {
        cards = cards.filter((card) =>
          tableMatchesSearch(card.displayName, tableSearchTrimmed),
        );
      }

      cards = sortWaiterBoardTableSummaries(
        cards,
        tables,
        checkoutRequestedTableIds,
        sessionMetaByTableId,
      );

      const checkoutCount = memberIds.filter(
        (id) => classifyWaiterTableBoardState(id, boardStateContext) === 'checkout',
      ).length;

      return { party, cards, checkoutCount, memberCount: memberIds.length };
    })
    .filter((row) => {
      if (boardFilter === 'all' && !tableSearchTrimmed) return true;
      return row.cards.length > 0;
    });

  const showCreateRow = boardFilter === 'all' && !tableSearchTrimmed;

  return (
    <div className="mb-6 space-y-4">
      {showCreateRow ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-brand-text-muted">{t.partyMarkerOnlyHint}</p>
          <button
            type="button"
            disabled={busy || isDemo}
            onClick={() => void createParty()}
            className="rounded-lg border border-sky-600/40 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-950 hover:bg-sky-500/15 disabled:opacity-50"
          >
            {busy ? t.partyCreating : t.partyCreate}
          </button>
        </div>
      ) : null}

      {visibleParties.map(({ party, cards, checkoutCount, memberCount }) => {
        const title = t.partySectionTitle
          .replace('{name}', party.name)
          .replace('{n}', String(memberCount));
        const checkoutHint =
          checkoutCount > 0
            ? t.partySectionCheckoutHint.replace('{n}', String(checkoutCount))
            : null;

        return (
          <section
            key={party.id}
            className="rounded-2xl border-2 border-sky-500/40 bg-sky-500/8 p-4 shadow-sm"
            aria-label={title}
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-sky-950">{title}</h2>
                {checkoutHint ? (
                  <p className="mt-0.5 text-xs text-amber-800">{checkoutHint}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || isDemo}
                  onClick={() => {
                    setAddTarget(party);
                    setSelectedIds([]);
                    setPendingMove(null);
                  }}
                  className="rounded-md border border-sky-700/30 bg-white/70 px-2.5 py-1 text-xs font-medium text-sky-950"
                >
                  {t.partyAddTables}
                </button>
                <button
                  type="button"
                  disabled={busy || isDemo}
                  onClick={() => void dissolveParty(party)}
                  className="rounded-md border border-brand-border bg-white/50 px-2.5 py-1 text-xs text-brand-text-muted"
                >
                  {t.partyDissolve}
                </button>
              </div>
            </div>

            {cards.length === 0 ? (
              <p className="text-sm text-brand-text-muted">{t.partyEmpty}</p>
            ) : (
              <div className={WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS}>
                {cards.map((card) => (
                  <div key={`party-${party.id}-${card.tableId}`} className="relative">
                    {renderTableCard(card, false)}
                    <button
                      type="button"
                      disabled={busy || isDemo}
                      onClick={() => void removeTable(party.id, card.tableId)}
                      className="absolute right-2 top-2 z-10 rounded bg-white/90 px-1.5 py-0.5 text-[11px] text-brand-text-muted shadow-sm"
                    >
                      {t.partyRemoveTable}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <Modal
        open={addTarget != null}
        onClose={() => {
          if (busy) return;
          setAddTarget(null);
          setSelectedIds([]);
          setPendingMove(null);
        }}
        title={t.partyAddTitle}
      >
        <p className="mb-3 text-sm text-brand-text-muted">{t.partyAddHint}</p>
        <ul className="mb-4 max-h-64 space-y-1 overflow-y-auto">
          {addCandidates.map((table) => {
            const otherPartyId = partyIdForTable(partyMembers, table.id);
            const otherParty = otherPartyId
              ? parties.find((p) => p.id === otherPartyId)
              : null;
            const checked = selectedIds.some((id) => tableIdsEqual(id, table.id));
            const state = classifyWaiterTableBoardState(table.id, boardStateContext);
            return (
              <li key={table.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-brand-border bg-brand-card px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedIds((prev) =>
                        checked
                          ? prev.filter((id) => !tableIdsEqual(id, table.id))
                          : [...prev, table.id],
                      );
                    }}
                  />
                  <span className="font-medium">{table.display_name}</span>
                  <span className="text-xs text-brand-text-muted">
                    {state === 'checkout'
                      ? t.filterCheckout
                      : state === 'dining'
                        ? t.filterDining
                        : t.filterIdle}
                    {otherParty ? ` · ${otherParty.name}` : ''}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setAddTarget(null);
              setSelectedIds([]);
            }}
            className="rounded-lg border border-brand-border px-3 py-2 text-sm"
          >
            {t.closeTableCancel}
          </button>
          <button
            type="button"
            disabled={busy || selectedIds.length === 0}
            onClick={() => {
              if (!addTarget) return;
              if (selectedIds.length === 0) {
                showToast(t.partySelectTables, 'info');
                return;
              }
              void submitAdd(addTarget.id, selectedIds, false);
            }}
            className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? t.partyAddOperating : t.partyAddConfirm}
          </button>
        </div>
      </Modal>

      <Modal
        open={pendingMove != null}
        onClose={() => {
          if (busy) return;
          setPendingMove(null);
        }}
        title={t.partyMoveConfirmTitle}
      >
        <p className="mb-4 text-sm text-brand-text">
          {t.partyMoveConfirmMessage.replace(
            '{tables}',
            pendingMove?.labels.join('、') ?? '',
          )}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setPendingMove(null)}
            className="rounded-lg border border-brand-border px-3 py-2 text-sm"
          >
            {t.closeTableCancel}
          </button>
          <button
            type="button"
            disabled={busy || !pendingMove}
            onClick={() => {
              if (!pendingMove) return;
              void submitAdd(pendingMove.partyId, pendingMove.tableIds, true);
            }}
            className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {t.partyMoveConfirmButton}
          </button>
        </div>
      </Modal>
    </div>
  );
}
