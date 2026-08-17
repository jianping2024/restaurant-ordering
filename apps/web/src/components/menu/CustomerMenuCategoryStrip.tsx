'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

function topPillClass(active: boolean, layout: 'scroll' | 'grid'): string {
  const width =
    layout === 'grid'
      ? 'w-full min-w-0 overflow-hidden whitespace-normal text-center leading-snug [overflow-wrap:anywhere]'
      : 'flex-shrink-0 whitespace-nowrap';
  return `${width} rounded-full border px-3 py-1.5 ${CUSTOMER_MENU_TYPE.categoryTop} transition-colors ${
    active ? topActiveClass : topIdleClass
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
      <div className="flex items-center pb-1.5">
        {moreOpen ? (
          <div className="min-h-8 min-w-0 flex-1" aria-hidden />
        ) : (
          <div ref={scrollRef} className="mesa-chip-scroll flex min-w-0 flex-1 items-center gap-2 px-4">
            {categoryPills}
          </div>
        )}
        {moreOpen ? null : (
          <button
            type="button"
            aria-expanded={false}
            aria-haspopup="dialog"
            onClick={() => setMoreOpen(true)}
            className={`${moreControlClass} text-brand-text-muted`}
          >
            {categoryMoreLabel} ▾
          </button>
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
              className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 ${CUSTOMER_MENU_TYPE.categorySub} rounded-full border transition-colors ${
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
