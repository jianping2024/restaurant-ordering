'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import type { UILanguage } from '@/lib/i18n';
import { tableIdsEqual, type RestaurantTableRow } from '@/lib/restaurant-tables';
import {
  filterTablesEligibleForPartyAdd,
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
  renameWaiterTableParty,
} from '@/lib/table-party-groups-client';
import {
  buildPartyOneClickMergePlan,
  type PartyOneClickMergePlan,
} from '@/lib/table-party-one-click-merge';
import { postWaiterTableActionClient } from '@/lib/staff-board-client';
import { WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS } from '@/lib/waiter-board-card-layout';
import { WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS } from '@/lib/waiter-board-card-theme';
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
import { commitWaiterSessionRelocation } from '@/lib/waiter-staff-mutation-sync';
import type { WaiterSessionRelocationBoardInput } from '@/lib/waiter-session-relocation-board';

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
  onSessionRelocationPatch: (input: WaiterSessionRelocationBoardInput) => void;
  onRefreshBoard: (tableIds: readonly string[]) => Promise<void>;
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
  onSessionRelocationPatch,
  onRefreshBoard,
  renderTableCard,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [addTarget, setAddTarget] = useState<TablePartyGroup | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingMove, setPendingMove] = useState<{
    partyId: string;
    tableIds: string[];
    labels: string[];
  } | null>(null);
  const [dissolveTarget, setDissolveTarget] = useState<TablePartyGroup | null>(null);
  const [mergeConfirm, setMergeConfirm] = useState<{
    party: TablePartyGroup;
    plan: Extract<PartyOneClickMergePlan, { kind: 'ready' }>;
  } | null>(null);
  const skipRenameBlurRef = useRef(false);

  const displayNameById = useMemo(
    () => new Map(tables.map((row) => [row.id, row.display_name])),
    [tables],
  );

  const beginRename = (party: TablePartyGroup) => {
    if (isDemo || busy) return;
    setEditingPartyId(party.id);
    setEditingName(party.name);
  };

  const cancelRename = () => {
    setEditingPartyId(null);
    setEditingName('');
  };

  const commitRename = async () => {
    if (skipRenameBlurRef.current) {
      skipRenameBlurRef.current = false;
      return;
    }
    if (!editingPartyId || isDemo) return;
    const partyId = editingPartyId;
    const party = parties.find((p) => p.id === partyId);
    const nextName = editingName.trim();
    if (!party) {
      cancelRename();
      return;
    }
    if (nextName === party.name) {
      cancelRename();
      return;
    }
    if (nextName.length < 1 || nextName.length > 32) {
      showToast(t.partyNameInvalid, 'error');
      setEditingName(party.name);
      return;
    }
    setBusy(true);
    try {
      const result = await renameWaiterTableParty(restaurantSlug, partyId, nextName);
      if (!result.ok) {
        showToast(
          result.error === 'duplicate_party_name' ? t.partyNameDuplicate : t.actionFailed,
          'error',
        );
        return;
      }
      onPartyStateChange(result.data);
      cancelRename();
    } finally {
      setBusy(false);
    }
  };

  const createParty = async () => {
    if (isDemo) {
      showToast(t.partyMarkerOnlyHint, 'info');
      return;
    }
    setBusy(true);
    try {
      const result = await createWaiterTableParty(restaurantSlug);
      if (!result.ok) {
        showToast(
          result.error === 'duplicate_party_name' ? t.partyNameDuplicate : t.partyCreateFailed,
          'error',
        );
        return;
      }
      onPartyStateChange(result.data);
      const createdId = result.data.createdPartyId;
      const created = createdId
        ? result.data.parties.find((p) => p.id === createdId)
        : null;
      if (created) {
        setEditingPartyId(created.id);
        setEditingName(created.name);
      }
    } finally {
      setBusy(false);
    }
  };

  const requestDissolve = (party: TablePartyGroup) => {
    if (isDemo) return;
    setDissolveTarget(party);
  };

  const confirmDissolve = async () => {
    if (!dissolveTarget || isDemo) return;
    const party = dissolveTarget;
    if (editingPartyId === party.id) cancelRename();
    setBusy(true);
    try {
      const result = await dissolveWaiterTableParty(restaurantSlug, party.id);
      if (!result.ok) {
        showToast(t.actionFailed, 'error');
        return;
      }
      onPartyStateChange(result.data);
      setDissolveTarget(null);
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

  const orderedMemberIdsForParty = (partyId: string): string[] => {
    const memberIds = membersForParty(partyMembers, partyId).map((m) => m.table_id);
    const memberCards = memberIds
      .map((id) => summaryByTableId.get(id))
      .filter((card): card is WaiterBoardTableSummary => !!card);
    return sortWaiterBoardTableSummaries(
      memberCards,
      tables,
      checkoutRequestedTableIds,
      sessionMetaByTableId,
    ).map((card) => card.tableId);
  };

  const requestOneClickMerge = (party: TablePartyGroup) => {
    if (isDemo) {
      showToast(t.partyMarkerOnlyHint, 'info');
      return;
    }
    const plan = buildPartyOneClickMergePlan(
      orderedMemberIdsForParty(party.id),
      (tableId) => classifyWaiterTableBoardState(tableId, boardStateContext),
      (tableId) => displayNameById.get(tableId) ?? tableId.slice(0, 8),
    );
    if (plan.kind === 'not_needed') {
      showToast(t.partyMergeNotNeeded, 'info');
      return;
    }
    setMergeConfirm({ party, plan });
  };

  const runOneClickMerge = async () => {
    if (!mergeConfirm || isDemo) return;
    const { party, plan } = mergeConfirm;
    setBusy(true);
    try {
      for (const sourceTableId of plan.sourceTableIds) {
        try {
          const { model } = await postWaiterTableActionClient(restaurantSlug, {
            action: 'merge',
            from_table_id: sourceTableId,
            to_table_id: plan.targetTableId,
          });
          commitWaiterSessionRelocation({
            sourceTableId,
            targetModel: model,
          });
          onSessionRelocationPatch({
            sourceTableId,
            targetModel: model,
          });
        } catch (err) {
          const apiErr = err as Error & { code?: string };
          const sourceLabel =
            displayNameById.get(sourceTableId) ?? sourceTableId.slice(0, 8);
          if (apiErr.code === 'session_billing') {
            showToast(t.checkoutLockedHint, 'error');
          } else {
            showToast(
              t.partyMergePartialFailed
                .replace('{source}', sourceLabel)
                .replace('{target}', plan.targetDisplayName),
              'error',
            );
          }
          await onRefreshBoard([sourceTableId, plan.targetTableId, ...plan.sourceTableIds]);
          setMergeConfirm(null);
          return;
        }
      }

      let partyState = {
        parties,
        partyMembers,
      };
      for (const sourceTableId of plan.sourceTableIds) {
        const result = await removeTableFromWaiterTableParty(
          restaurantSlug,
          party.id,
          sourceTableId,
        );
        if (!result.ok) {
          showToast(t.partyMergeRemoveFailed, 'error');
          onPartyStateChange(partyState);
          await onRefreshBoard([plan.targetTableId, ...plan.sourceTableIds]);
          setMergeConfirm(null);
          return;
        }
        partyState = result.data;
      }
      onPartyStateChange(partyState);
      setMergeConfirm(null);
      showToast(
        t.partyMergeDone.replace('{table}', plan.targetDisplayName),
        'success',
      );
      await onRefreshBoard([plan.targetTableId, ...plan.sourceTableIds]);
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
        showToast(
          result.error === 'tables_not_dining' ? t.partyAddOpenTableFirst : t.partyAddFailed,
          'error',
        );
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
    return filterTablesEligibleForPartyAdd(
      tables,
      partyMembers,
      addTarget.id,
      boardStateContext,
    );
  }, [addTarget, boardStateContext, partyMembers, tables]);

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
        const isEditing = editingPartyId === party.id;
        const countLabel = t.partySectionCount.replace('{n}', String(memberCount));
        const title = `${isEditing ? editingName : party.name} ${countLabel}`;
        const checkoutHint =
          checkoutCount > 0
            ? t.partySectionCheckoutHint.replace('{n}', String(checkoutCount))
            : null;

        return (
          <section
            key={party.id}
            className="rounded-2xl border-[3px] border-sky-600/80 bg-sky-500/8 p-4 shadow-md"
            aria-label={title}
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-baseline gap-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingName}
                      autoFocus
                      maxLength={32}
                      disabled={busy}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => void commitRename()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          skipRenameBlurRef.current = true;
                          cancelRename();
                        }
                      }}
                      className="min-w-[8rem] max-w-[14rem] rounded-md border border-sky-700/40 bg-white px-2 py-0.5 text-sm font-semibold text-sky-950 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                      aria-label={party.name}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={busy || isDemo}
                      onClick={() => beginRename(party)}
                      className="text-left text-sm font-semibold text-sky-950 hover:underline disabled:opacity-50"
                    >
                      {party.name}
                    </button>
                  )}
                  <span className="text-sm font-semibold text-sky-950">{countLabel}</span>
                </div>
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
                  onClick={() => requestOneClickMerge(party)}
                  className="rounded-md border border-amber-700/35 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-950"
                >
                  {t.partyMergeAll}
                </button>
                <button
                  type="button"
                  disabled={busy || isDemo}
                  onClick={() => requestDissolve(party)}
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
                {cards.map((card) => {
                  const boardState = classifyWaiterTableBoardState(
                    card.tableId,
                    boardStateContext,
                  );
                  return (
                    <div key={`party-${party.id}-${card.tableId}`} className="pt-6">
                      <div className="relative">
                        {renderTableCard(card, false)}
                        <button
                          type="button"
                          disabled={busy || isDemo}
                          onClick={() => void removeTable(party.id, card.tableId)}
                          className={`absolute bottom-full right-3 z-10 rounded-t-md border border-b-0 px-2 py-0.5 text-xs disabled:opacity-50 ${WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS[boardState]}`}
                        >
                          {t.partyRemoveTable}
                        </button>
                      </div>
                    </div>
                  );
                })}
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
        {addCandidates.length === 0 ? (
          <p className="mb-4 rounded-lg border border-dashed border-brand-border bg-brand-bg px-3 py-4 text-sm text-brand-text-muted">
            {t.partyAddOpenTableFirst}
          </p>
        ) : (
          <ul className="mb-4 max-h-64 space-y-1 overflow-y-auto">
            {addCandidates.map((table) => {
              const otherPartyId = partyIdForTable(partyMembers, table.id);
              const otherParty = otherPartyId
                ? parties.find((p) => p.id === otherPartyId)
                : null;
              const checked = selectedIds.some((id) => tableIdsEqual(id, table.id));
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
                      {t.filterDining}
                      {otherParty ? ` · ${otherParty.name}` : ''}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
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

      <ConfirmModal
        open={pendingMove != null}
        onClose={() => {
          if (busy) return;
          setPendingMove(null);
        }}
        title={t.partyMoveConfirmTitle}
        message={t.partyMoveConfirmMessage.replace(
          '{tables}',
          pendingMove?.labels.join('、') ?? '',
        )}
        confirmLabel={t.partyMoveConfirmButton}
        cancelLabel={t.closeTableCancel}
        confirming={busy}
        onConfirm={() => {
          if (!pendingMove) return;
          void submitAdd(pendingMove.partyId, pendingMove.tableIds, true);
        }}
      />

      <ConfirmModal
        open={dissolveTarget != null}
        onClose={() => {
          if (busy) return;
          setDissolveTarget(null);
        }}
        title={t.partyDissolve}
        message={t.partyDissolveConfirm}
        confirmLabel={t.partyDissolve}
        cancelLabel={t.closeTableCancel}
        variant="danger"
        confirming={busy}
        onConfirm={confirmDissolve}
      />

      <Modal
        open={mergeConfirm != null}
        onClose={() => {
          if (busy) return;
          setMergeConfirm(null);
        }}
        title={t.partyMergeTitle}
      >
        <p className="mb-2 text-sm text-brand-text-muted">{t.partyMergeHint}</p>
        <p className="mb-1 text-center text-xs font-medium uppercase tracking-wide text-brand-text-muted">
          {t.partyMergeTargetLabel}
        </p>
        <p className="mb-4 text-center text-4xl font-bold tracking-tight text-sky-950 sm:text-5xl">
          {mergeConfirm?.plan.targetDisplayName ?? ''}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setMergeConfirm(null)}
            className="rounded-lg border border-brand-border px-3 py-2 text-sm"
          >
            {t.closeTableCancel}
          </button>
          <button
            type="button"
            disabled={busy || !mergeConfirm}
            onClick={() => void runOneClickMerge()}
            className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? t.partyMergeOperating : t.partyMergeConfirm}
          </button>
        </div>
      </Modal>
    </div>
  );
}
