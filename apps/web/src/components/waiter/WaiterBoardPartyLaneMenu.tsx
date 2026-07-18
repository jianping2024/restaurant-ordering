'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  WAITER_BOARD_LANE_CHROME,
  waiterBoardType,
} from '@/lib/waiter-board-card-theme';
import type { WaiterBoardPartyLane } from '@/lib/waiter-board-party-lanes';

type Props = {
  parties: readonly WaiterBoardPartyLane[];
  selectedPartyId: string | null;
  canCreate: boolean;
  busy: boolean;
  createDisabled: boolean;
  menuLabel: string;
  createLabel: string;
  creatingLabel: string;
  sectionCountLabel: (n: number) => string;
  onCreate: () => void;
  onSelectParty: (partyId: string) => void;
};

/**
 * Single entry for together-groups on the waiter board lane strip:
 * open menu → create or select a party (replaces per-party tabs + create button).
 */
export function WaiterBoardPartyLaneMenu({
  parties,
  selectedPartyId,
  canCreate,
  busy,
  createDisabled,
  menuLabel,
  createLabel,
  creatingLabel,
  sectionCountLabel,
  onCreate,
  onSelectParty,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const selected = selectedPartyId
    ? parties.find((row) => row.party.id === selectedPartyId) ?? null
    : null;
  const active = selected != null;
  const triggerLabel = selected ? selected.party.name : menuLabel;
  const triggerMeta = selected ? sectionCountLabel(selected.memberCount) : null;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (busy) setOpen(false);
  }, [busy]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className={`${WAITER_BOARD_LANE_CHROME.base} ${
          active ? WAITER_BOARD_LANE_CHROME.active : WAITER_BOARD_LANE_CHROME.idle
        } disabled:opacity-50`}
      >
        <span className={waiterBoardType.laneLabel}>{triggerLabel}</span>
        {triggerMeta ? (
          <span className={waiterBoardType.laneMeta}>{triggerMeta}</span>
        ) : null}
        <span aria-hidden className="text-xs opacity-70">
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={menuLabel}
          className="absolute right-0 top-full z-30 mt-1.5 max-h-[min(20rem,70vh)] min-w-[12rem] overflow-y-auto rounded-xl border border-brand-border bg-brand-card py-1 shadow-md"
        >
          {canCreate ? (
            <button
              type="button"
              role="menuitem"
              disabled={createDisabled || busy}
              onClick={() => {
                setOpen(false);
                onCreate();
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-brand-text transition-colors hover:bg-brand-gold/15 disabled:opacity-50"
            >
              {busy ? creatingLabel : createLabel}
            </button>
          ) : null}
          {parties.map(({ party, memberCount }) => {
            const isSelected = party.id === selectedPartyId;
            return (
              <button
                key={party.id}
                type="button"
                role="menuitem"
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => {
                  setOpen(false);
                  onSelectParty(party.id);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                  isSelected
                    ? 'bg-brand-gold/15 font-medium text-brand-text'
                    : 'text-brand-text-muted hover:bg-brand-bg/70 hover:text-brand-text'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{party.name}</span>
                <span className="shrink-0 tabular-nums opacity-80">
                  {sectionCountLabel(memberCount)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
