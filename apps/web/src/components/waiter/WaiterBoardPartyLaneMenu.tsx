'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
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

const MENU_GAP = 6;
const VIEWPORT_PAD = 8;

function computeMenuCoords(anchor: HTMLElement, menu: HTMLElement) {
  const anchorRect = anchor.getBoundingClientRect();
  const menuHeight = menu.offsetHeight;
  const menuWidth = menu.offsetWidth;

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const spaceAbove = anchorRect.top;
  const openUpward = spaceBelow < menuHeight + MENU_GAP && spaceAbove > spaceBelow;

  let top = openUpward ? anchorRect.top - menuHeight - MENU_GAP : anchorRect.bottom + MENU_GAP;
  // Prefer left-align with trigger; if near the right edge, right-align instead.
  let left = anchorRect.left;
  if (left + menuWidth > window.innerWidth - VIEWPORT_PAD) {
    left = anchorRect.right - menuWidth;
  }

  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - menuWidth - VIEWPORT_PAD));
  top = Math.max(VIEWPORT_PAD, Math.min(top, window.innerHeight - menuHeight - VIEWPORT_PAD));

  return { top, left };
}

/**
 * Single entry for together-groups on the waiter board lane strip:
 * open menu → create (primary action) or select a party.
 * Menu portals to body so it stays visible inside the horizontal chip scroll.
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
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const selected = selectedPartyId
    ? parties.find((row) => row.party.id === selectedPartyId) ?? null
    : null;
  const active = selected != null;
  const triggerLabel = selected ? selected.party.name : menuLabel;
  const triggerMeta = selected ? sectionCountLabel(selected.memberCount) : null;

  const updateCoords = useCallback(() => {
    const anchor = rootRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    setCoords(computeMenuCoords(anchor, menu));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
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
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={menuLabel}
              className="fixed z-30 flex max-h-[min(20rem,70vh)] min-w-[12rem] flex-col overflow-hidden rounded-xl border border-brand-border bg-brand-card shadow-md"
              style={{
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
                visibility: coords ? 'visible' : 'hidden',
              }}
            >
              {canCreate ? (
                <div
                  className={`shrink-0 p-2 ${
                    parties.length > 0 ? 'border-b border-brand-border/50' : ''
                  }`}
                >
                  <Button
                    type="button"
                    role="menuitem"
                    variant="gold"
                    size="sm"
                    className="w-full"
                    disabled={createDisabled || busy}
                    loading={busy}
                    onClick={() => {
                      setOpen(false);
                      onCreate();
                    }}
                  >
                    {busy ? creatingLabel : createLabel}
                  </Button>
                </div>
              ) : null}
              {parties.length > 0 ? (
                <div className="min-h-0 flex-1 overflow-y-auto py-1">
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
