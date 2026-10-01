'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import {
  mesaSelectionChipShellClass,
  mesaSelectionChipSoftClass,
  mesaSelectionChipStrongClass,
} from '@/lib/mesa-selection-chip';

export type CustomerMenuCategoryOption = {
  id: string;
  label: string;
};

type Props = {
  topCategories: CustomerMenuCategoryOption[];
  activeTopId: string;
  onSelectTop: (id: string) => void;
  subCategories: CustomerMenuCategoryOption[];
  activeSubpath: string;
  onSelectSubpath: (id: string) => void;
  subcategoryAllLabel: string;
  /** Accessible name for the more entry + overlay (visible label is icon-only). */
  categoryMoreLabel: string;
};

/**
 * Sole more entry chrome for the customer category strip (scheme B):
 * fade + round icon control; hit size matches top-pill box
 * (`py-1.5` + `categoryTop` text-base line-height 24 + 1px borders = 38)
 * and idle chip border/bg family.
 * Slot must fully cover scroll overflow so pill borders never peek past the icon.
 */
const MORE_SLOT_CLASS = 'w-14';
const MORE_FADE_CLASS = 'w-6';
const MORE_FADE_RIGHT_CLASS = 'right-14';
/** more slot 56 + fade 24 + gap 8 */
const SCROLL_END_PAD_CLASS = 'pr-[5.5rem]';
/** Same box as top pills: 6+6 padding + 24 line + 1+1 border. */
const MORE_HIT_CLASS = 'flex h-[38px] w-[38px] items-center justify-center';

function topPillClass(active: boolean, layout: 'scroll' | 'grid'): string {
  const width =
    layout === 'grid'
      ? 'w-full min-w-0 overflow-hidden whitespace-normal text-center leading-snug [overflow-wrap:anywhere]'
      : 'flex-shrink-0 whitespace-nowrap';
  return `${width} ${mesaSelectionChipShellClass} px-3 py-1.5 ${CUSTOMER_MENU_TYPE.categoryTop} ${
    active ? `${mesaSelectionChipStrongClass(true)} ${CUSTOMER_MENU_TYPE.categoryTopActive}` : mesaSelectionChipStrongClass(false)
  }`;
}

function TopCategoryPill({
  cat,
  active,
  layout,
  onSelect,
}: {
  cat: CustomerMenuCategoryOption;
  active: boolean;
  layout: 'scroll' | 'grid';
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      data-category-id={cat.id}
      title={cat.label}
      onClick={() => onSelect(cat.id)}
      className={topPillClass(active, layout)}
    >
      {cat.label}
    </button>
  );
}

function CategoryMoreGridIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden>
      <rect x="1" y="1" width="6" height="6" rx="1.2" />
      <rect x="9" y="1" width="6" height="6" rx="1.2" />
      <rect x="1" y="9" width="6" height="6" rx="1.2" />
      <rect x="9" y="9" width="6" height="6" rx="1.2" />
    </svg>
  );
}

/** Sole top + sub category strip for customer menu (standard + sushi). */
export function CustomerMenuCategoryStrip({
  topCategories,
  activeTopId,
  onSelectTop,
  subCategories,
  activeSubpath,
  onSelectSubpath,
  subcategoryAllLabel,
  categoryMoreLabel,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  useLayoutEffect(() => {
    if (moreOpen) return;
    const selected = scrollRef.current?.querySelector(
      `[data-category-id="${CSS.escape(activeTopId)}"]`,
    );
    selected?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [activeTopId, moreOpen]);

  const selectTop = (id: string) => {
    onSelectTop(id);
    setMoreOpen(false);
  };

  const categoryPills = topCategories.map((cat) => (
    <TopCategoryPill
      key={cat.id}
      cat={cat}
      active={activeTopId === cat.id}
      layout={moreOpen ? 'grid' : 'scroll'}
      onSelect={selectTop}
    />
  ));

  return (
    <div className="relative">
      <div className="relative overflow-hidden pb-1.5">
        {moreOpen ? (
          <div className="min-h-8" aria-hidden />
        ) : (
          <div className="relative flex min-h-9 items-center">
            <div
              ref={scrollRef}
              className={`mesa-chip-scroll flex min-w-0 flex-1 items-center gap-2 px-4 ${SCROLL_END_PAD_CLASS}`}
            >
              {categoryPills}
            </div>
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 z-[2] ${MORE_FADE_RIGHT_CLASS} ${MORE_FADE_CLASS} bg-gradient-to-r from-transparent to-brand-bg`}
            />
            <button
              type="button"
              aria-expanded={false}
              aria-haspopup="dialog"
              aria-label={categoryMoreLabel}
              onClick={() => setMoreOpen(true)}
              className={`absolute inset-y-0 right-0 z-[3] ${MORE_SLOT_CLASS} grid place-items-center bg-brand-bg`}
            >
              <span
                className={`place-items-center text-brand-gold ${MORE_HIT_CLASS} ${mesaSelectionChipShellClass} ${mesaSelectionChipStrongClass(false)}`}
              >
                <CategoryMoreGridIcon />
              </span>
            </button>
          </div>
        )}
      </div>

      {moreOpen ? (
        <>
          <button
            type="button"
            className="absolute inset-x-0 top-0 z-20 h-screen bg-black/40"
            aria-label={categoryMoreLabel}
            onClick={() => setMoreOpen(false)}
          />
          <div
            role="dialog"
            aria-label={categoryMoreLabel}
            className="absolute inset-x-0 top-0 z-30 max-h-[min(50vh,24rem)] overflow-y-auto border-b border-brand-border bg-brand-card px-4 py-3"
          >
            <div className="grid grid-cols-2 gap-2">{categoryPills}</div>
          </div>
        </>
      ) : null}

      {!moreOpen && subCategories.length > 0 ? (
        <div className="mesa-chip-scroll flex gap-2 px-4 pb-1.5">
          <button
            type="button"
            onClick={() => onSelectSubpath('')}
            className={`flex-shrink-0 px-3 py-1.5 ${CUSTOMER_MENU_TYPE.categorySub} ${mesaSelectionChipShellClass} ${mesaSelectionChipSoftClass(activeSubpath === '')}`}
          >
            {subcategoryAllLabel}
          </button>
          {subCategories.map((sub) => (
            <button
              key={sub.id}
              type="button"
              title={sub.label}
              onClick={() => onSelectSubpath(sub.id)}
              className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 ${CUSTOMER_MENU_TYPE.categorySub} ${mesaSelectionChipShellClass} ${mesaSelectionChipSoftClass(activeSubpath === sub.id)}`}
            >
              {sub.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
