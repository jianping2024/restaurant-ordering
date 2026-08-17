'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import {
  countVisibleCategoryPills,
  CUSTOMER_MENU_CATEGORY_ROW_GAP_PX,
} from '@/lib/customer-menu-category-overflow';

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
const topActiveClass = `border-brand-gold bg-brand-gold text-brand-ink ${CUSTOMER_MENU_TYPE.categoryTopActive}`;
const subIdleClass = 'border-brand-border text-brand-text';
const subActiveClass = 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold';

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
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(topCategories.length);
  const [moreOpen, setMoreOpen] = useState(false);

  const topKey = topCategories.map((cat) => `${cat.id}:${cat.label}`).join('|');

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;

    const recompute = () => {
      const chips = Array.from(measure.querySelectorAll<HTMLElement>('[data-cat-chip]'));
      const moreEl = measure.querySelector<HTMLElement>('[data-cat-more]');
      const next = countVisibleCategoryPills({
        containerWidth: row.clientWidth,
        chipWidths: chips.map((el) => el.getBoundingClientRect().width),
        moreWidth: moreEl?.getBoundingClientRect().width ?? 0,
        gap: CUSTOMER_MENU_CATEGORY_ROW_GAP_PX,
      });
      setVisibleCount(next);
      if (next >= topCategories.length) setMoreOpen(false);
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(row);
    return () => observer.disconnect();
  }, [topKey, categoryMoreLabel, topCategories.length]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const needsMore = visibleCount < topCategories.length;
  const visibleCategories = moreOpen
    ? topCategories
    : needsMore
      ? topCategories.slice(0, visibleCount)
      : topCategories;

  const selectTop = (id: string) => {
    onSelectTop(id);
    setMoreOpen(false);
  };

  return (
    <div className="relative">
      <div
        ref={measureRef}
        className="pointer-events-none absolute left-0 top-0 -z-10 flex h-0 gap-2 overflow-hidden opacity-0"
        aria-hidden
      >
        {topCategories.map((cat) => (
          <span key={cat.id} data-cat-chip className={topPillClass(false)}>
            {cat.label}
          </span>
        ))}
        <span data-cat-more className={topPillClass(false)}>
          {categoryMoreLabel} ▾
        </span>
      </div>

      <div className={`px-4 ${moreOpen ? 'pb-3' : 'pb-1.5'}`}>
        <div
          ref={rowRef}
          className={moreOpen ? 'flex flex-wrap gap-2' : 'flex items-center gap-2'}
          role={moreOpen ? 'dialog' : undefined}
          aria-label={moreOpen ? categoryMoreLabel : undefined}
        >
          {visibleCategories.map((cat) => (
            <TopCategoryPill
              key={cat.id}
              cat={cat}
              active={activeTopId === cat.id}
              onSelect={selectTop}
            />
          ))}
          {needsMore && !moreOpen ? (
            <button
              type="button"
              aria-expanded={false}
              aria-haspopup="dialog"
              onClick={() => setMoreOpen(true)}
              className={topPillClass(false)}
            >
              {categoryMoreLabel} ▾
            </button>
          ) : null}
        </div>
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
