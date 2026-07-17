'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
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
import { buildVisibleWaiterBoardPartyLanes } from '@/lib/waiter-board-party-lanes';
import { WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS } from '@/lib/waiter-board-card-layout';
import {
  WAITER_BOARD_PARTY_PANEL_CLASS,
  WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS,
} from '@/lib/waiter-board-card-theme';
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

export type WaiterBoardPartySectionHandle = {
  createParty: () => Promise<void>;
};

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
  /** When set, only that together-group panel is shown (lane tab selection). */
  selectedPartyId: string | null;
  onPartyCreated: (partyId: string) => void;
  onBusyChange?: (busy: boolean) => void;
  onPartyStateChange: (next: {
    parties: TablePartyGroup[];
    partyMembers: TablePartyGroupMember[];
  }) => void;
  onSessionRelocationPatch: (input: WaiterSessionRelocationBoardInput) => void;
  onRefreshBoard: (tableIds: readonly string[]) => Promise<void>;
  renderTableCard: (card: WaiterBoardTableSummary, pinned?: boolean) => ReactNode;
};

export const WaiterBoardPartySections = forwardRef<WaiterBoardPartySectionHandle, Props>(
  function WaiterBoardPartySections(
    {
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
      selectedPartyId,
      onPartyCreated,
      onBusyChange,
      onPartyStateChange,
      onSessionRelocationPatch,
      onRefreshBoard,
      renderTableCard,
    },
    ref,
  ) {
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

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const displayNameById = useMemo(
    () => new Map(tables.map((row) => [row.id, row.display_name])),
    [tables],
  );

  const visibleParties = useMemo(
    () =>
      buildVisibleWaiterBoardPartyLanes({
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
      }),
    [
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
    ],
  );

  const selectedLane = useMemo(
    () =>
      selectedPartyId
        ? visibleParties.find((row) => row.party.id === selectedPartyId) ?? null
        : null,
    [selectedPartyId, visibleParties],
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

  const createParty = useCallback(async () => {
    if (isDemo) {
      showToast(t.partyDemoReadonly, 'info');
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
        onPartyCreated(created.id);
        setEditingPartyId(created.id);
        setEditingName(created.name);
      }
    } finally {
      setBusy(false);
    }
  }, [
    isDemo,
    onPartyCreated,
    onPartyStateChange,
    restaurantSlug,
    t.partyCreateFailed,
    t.partyDemoReadonly,
    t.partyNameDuplicate,
  ]);

  useImperativeHandle(ref, () => ({ createParty }), [createParty]);

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
      showToast(t.partyDemoReadonly, 'info');
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

  const selectedParty = selectedLane?.party ?? null;
  const selectedCards = selectedLane?.cards ?? [];
  const selectedCheckoutCount = selectedLane?.checkoutCount ?? 0;
  const selectedMemberCount = selectedLane?.memberCount ?? 0;
  const isEditingSelected = selectedParty != null && editingPartyId === selectedParty.id;
  const selectedCountLabel = t.partySectionCount.replace('{n}', String(selectedMemberCount));
  const selectedTitle = selectedParty
    ? `${isEditingSelected ? editingName : selectedParty.name} ${selectedCountLabel}`
    : '';
  const selectedCheckoutHint =
    selectedCheckoutCount > 0
      ? t.partySectionCheckoutHint.replace('{n}', String(selectedCheckoutCount))
      : null;

  return (
    <>
      {selectedParty ? (
        <div className="mb-6">
          <section
            className={WAITER_BOARD_PARTY_PANEL_CLASS}
            aria-label={selectedTitle}
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-baseline gap-1.5">
                  {isEditingSelected ? (
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
                      className="min-w-[8rem] max-w-[14rem] rounded-lg border border-brand-border bg-brand-bg px-2.5 py-1.5 text-sm font-semibold text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                      aria-label={selectedParty.name}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={busy || isDemo}
                      onClick={() => beginRename(selectedParty)}
                      className="text-left text-sm font-semibold text-brand-text hover:underline disabled:opacity-50"
                    >
                      {selectedParty.name}
                    </button>
                  )}
                  <span className="text-sm font-medium text-brand-text-muted">{selectedCountLabel}</span>
                </div>
                {selectedCheckoutHint ? (
                  <p className="mt-0.5 text-sm mesa-text-warning">{selectedCheckoutHint}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  disabled={busy || isDemo}
                  onClick={() => {
                    setAddTarget(selectedParty);
                    setSelectedIds([]);
                    setPendingMove(null);
                  }}
                >
                  {t.partyAddTables}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || isDemo}
                  onClick={() => requestOneClickMerge(selectedParty)}
                >
                  {t.partyMergeAll}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || isDemo}
                  onClick={() => requestDissolve(selectedParty)}
                >
                  {t.partyDissolve}
                </Button>
              </div>
            </div>

            {selectedCards.length === 0 ? (
              <p className="text-sm text-brand-text-muted">{t.partyEmpty}</p>
            ) : (
              <div className={WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS}>
                {selectedCards.map((card) => {
                  const boardState = classifyWaiterTableBoardState(
                    card.tableId,
                    boardStateContext,
                  );
                  return (
                    <div key={`party-${selectedParty.id}-${card.tableId}`} className="pt-6">
                      <div className="relative">
                        {renderTableCard(card, false)}
                        <button
                          type="button"
                          disabled={busy || isDemo}
                          onClick={() => void removeTable(selectedParty.id, card.tableId)}
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
        </div>
      ) : null}

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
          <Button
            type="button"
            variant="soft"
            size="sm"
            disabled={busy}
            onClick={() => {
              setAddTarget(null);
              setSelectedIds([]);
            }}
          >
            {t.closeTableCancel}
          </Button>
          <Button
            type="button"
            variant="gold"
            size="sm"
            disabled={busy || selectedIds.length === 0}
            loading={busy}
            onClick={() => {
              if (!addTarget) return;
              if (selectedIds.length === 0) {
                showToast(t.partySelectTables, 'info');
                return;
              }
              void submitAdd(addTarget.id, selectedIds, false);
            }}
          >
            {busy ? t.partyAddOperating : t.partyAddConfirm}
          </Button>
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
        <p className="mb-4 text-center font-heading text-4xl font-bold tracking-tight text-brand-text sm:text-5xl">
          {mergeConfirm?.plan.targetDisplayName ?? ''}
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="soft"
            size="sm"
            disabled={busy}
            onClick={() => setMergeConfirm(null)}
          >
            {t.closeTableCancel}
          </Button>
          <Button
            type="button"
            variant="gold"
            size="sm"
            disabled={busy || !mergeConfirm}
            loading={busy}
            onClick={() => void runOneClickMerge()}
          >
            {busy ? t.partyMergeOperating : t.partyMergeConfirm}
          </Button>
        </div>
      </Modal>
    </>
  );
  },
);
