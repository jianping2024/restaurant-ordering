'use client';

import { useEffect, useState } from 'react';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';

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
  categoryMoreLabel: string;
};

const topIdleClass = 'border-brand-border bg-brand-bg text-brand-text';
const topActiveClass = `border-brand-gold bg-brand-gold text-brand-on-gold ${CUSTOMER_MENU_TYPE.categoryTopActive}`;
const subIdleClass = 'border-brand-border text-brand-text';
const subActiveClass = 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold';
const moreControlClass =
  'inline-flex h-8 w-[72px] shrink-0 items-center justify-center gap-0.5 whitespace-nowrap pr-3 pl-1 text-xs font-medium';

function topPillClass(active: boolean): string {
  return `max-w-[9.5rem] flex-shrink-0 truncate rounded-full border px-3 py-1.5 ${CUSTOMER_MENU_TYPE.categoryTop} transition-colors ${
    active ? topActiveClass : topIdleClass
  }`;
}

function TopCategoryPill({
  cat,
  active,
  onSelect,
}: {
  cat: CustomerMenuCategoryOption;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      title={cat.label}
      onClick={() => onSelect(cat.id)}
      className={topPillClass(active)}
    >
      {cat.label}
    </button>
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

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const selectTop = (id: string) => {
    onSelectTop(id);
    setMoreOpen(false);
  };

  return (
    <div className="relative">
      <div className={`flex items-start ${moreOpen ? 'pb-3' : 'pb-1.5'}`}>
        <div
          className={
            moreOpen
              ? 'flex min-w-0 flex-1 flex-wrap gap-2 px-4'
              : 'mesa-chip-scroll flex min-w-0 flex-1 items-center gap-2 px-4'
          }
          role={moreOpen ? 'dialog' : undefined}
          aria-label={moreOpen ? categoryMoreLabel : undefined}
        >
          {topCategories.map((cat) => (
            <TopCategoryPill
              key={cat.id}
              cat={cat}
              active={activeTopId === cat.id}
              onSelect={selectTop}
            />
          ))}
        </div>
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen((open) => !open)}
          className={`${moreControlClass} ${moreOpen ? 'text-brand-gold' : 'text-brand-text-muted'}`}
        >
          {categoryMoreLabel} {moreOpen ? '▴' : '▾'}
        </button>
      </div>

      {moreOpen ? (
        <button
          type="button"
          className="absolute inset-x-0 top-full z-20 h-screen bg-black/40"
          aria-label={categoryMoreLabel}
          onClick={() => setMoreOpen(false)}
        />
      ) : null}

      {!moreOpen && subCategories.length > 0 ? (
        <div className="mesa-chip-scroll flex gap-2 px-4 pb-1.5">
          <button
            type="button"
            onClick={() => onSelectSubpath('')}
            className={`flex-shrink-0 px-3 py-1.5 ${CUSTOMER_MENU_TYPE.categorySub} rounded-full border transition-colors ${
              activeSubpath === '' ? subActiveClass : subIdleClass
            }`}
          >
            {subcategoryAllLabel}
          </button>
          {subCategories.map((sub) => (
            <button
              key={sub.id}
              type="button"
              title={sub.label}
              onClick={() => onSelectSubpath(sub.id)}
              className={`max-w-[9.5rem] flex-shrink-0 truncate px-3 py-1.5 ${CUSTOMER_MENU_TYPE.categorySub} rounded-full border transition-colors ${
                activeSubpath === sub.id ? subActiveClass : subIdleClass
              }`}
            >
              {sub.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
