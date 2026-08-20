'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { personalSettingsDropdownActionRowClass } from '@/lib/dashboard-top-nav';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuLabel: string;
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
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
  let left = anchorRect.right - menuWidth;
  if (left < VIEWPORT_PAD) left = anchorRect.left;

  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - menuWidth - VIEWPORT_PAD));
  top = Math.max(VIEWPORT_PAD, Math.min(top, window.innerHeight - menuHeight - VIEWPORT_PAD));

  return { top, left };
}

/**
 * Sole secondary actions for a menu dish list row: edit + delete behind one ⋯ trigger.
 * Portals to body so sticky/scroll parents do not clip the menu.
 */
export function MenuItemListRowOverflowMenu({
  open,
  onOpenChange,
  menuLabel,
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
}: Props) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

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
      onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={menuLabel}
        title={menuLabel}
        onClick={() => onOpenChange(!open)}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-brand-border/70 bg-brand-card text-brand-text leading-none hover:border-brand-gold/35 hover:bg-brand-gold/15 hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/45 transition-colors ${
          open ? 'border-brand-gold/45 bg-brand-gold/15 text-brand-gold' : ''
        }`}
      >
        <span aria-hidden className="text-sm font-semibold tracking-widest">
          ⋯
        </span>
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={menuLabel}
              className="fixed z-40 min-w-[10rem] overflow-hidden rounded-xl border border-brand-border bg-brand-card py-1 shadow-lg shadow-black/10"
              style={{
                top: coords?.top ?? 0,
                left: coords?.left ?? 0,
                visibility: coords ? 'visible' : 'hidden',
              }}
            >
              <button
                type="button"
                role="menuitem"
                className={`${personalSettingsDropdownActionRowClass()} text-brand-text hover:bg-brand-surface/80 border-b-0`}
                onClick={() => {
                  onOpenChange(false);
                  onEdit();
                }}
              >
                {editLabel}
              </button>
              <button
                type="button"
                role="menuitem"
                className={`${personalSettingsDropdownActionRowClass()} text-status-danger hover:bg-[rgb(var(--color-status-danger-border)/0.08)] border-b-0`}
                onClick={() => {
                  onOpenChange(false);
                  onDelete();
                }}
              >
                {deleteLabel}
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
