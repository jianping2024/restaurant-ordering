'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS,
  customerMenuCategoryRailStickyClass,
} from '@/lib/customer-menu-chrome-layout';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import {
  mesaSelectionChipShellClass,
  mesaSelectionChipSoftClass,
} from '@/lib/mesa-selection-chip';
import { CUSTOMER_MENU_ITEM_LIST_HOST_CLASS } from '@/lib/menu-item-card-layout';

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
  /** page = document scroll + sticky rail; embedded = dual overflow panes. */
  variant: 'page' | 'embedded';
  children: ReactNode;
};

function railItemClass(active: boolean): string {
  return [
    'relative w-full px-1.5 py-3 text-center',
    CUSTOMER_MENU_TYPE.categoryTop,
    active
      ? `bg-brand-bg text-brand-gold ${CUSTOMER_MENU_TYPE.categoryTopActive}`
      : 'text-brand-text-muted hover:text-brand-text',
  ].join(' ');
}

/**
 * Sole customer/staff/sushi category chrome: left vertical top-category rail +
 * optional soft sub chips above the catalog column. Filter-on-select (no scroll-spy).
 * No top horizontal strip / no「更多」overlay.
 */
export function CustomerMenuCategoryNav({
  topCategories,
  activeTopId,
  onSelectTop,
  subCategories,
  activeSubpath,
  onSelectSubpath,
  subcategoryAllLabel,
  variant,
  children,
}: Props) {
  const railRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const selected = railRef.current?.querySelector(
      `[data-category-id="${CSS.escape(activeTopId)}"]`,
    );
    selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTopId]);

  const shellClass =
    variant === 'embedded'
      ? 'flex min-h-0 flex-1'
      : 'flex items-start';

  const railClass =
    variant === 'embedded'
      ? `${CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS} flex shrink-0 flex-col overflow-y-auto border-r border-brand-border bg-brand-card/40`
      : `${CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS} ${customerMenuCategoryRailStickyClass} flex shrink-0 flex-col overflow-y-auto border-r border-brand-border bg-brand-card/40`;

  const catalogClass =
    variant === 'embedded'
      ? `${CUSTOMER_MENU_ITEM_LIST_HOST_CLASS} min-w-0 flex-1 overflow-y-auto px-3 py-4`
      : `${CUSTOMER_MENU_ITEM_LIST_HOST_CLASS} min-w-0 flex-1 px-3 py-4`;

  return (
    <div className={shellClass}>
      <nav ref={railRef} className={railClass} aria-label="categories">
        {topCategories.map((cat) => {
          const active = activeTopId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              data-category-id={cat.id}
              title={cat.label}
              aria-current={active ? 'true' : undefined}
              onClick={() => onSelectTop(cat.id)}
              className={railItemClass(active)}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-y-[20%] left-0 w-[3px] rounded-r-sm bg-brand-gold"
                />
              ) : null}
              <span className="line-clamp-2 break-words [overflow-wrap:anywhere]">{cat.label}</span>
            </button>
          );
        })}
      </nav>

      <div className={catalogClass}>
        {subCategories.length > 0 ? (
          <div className="mesa-chip-scroll mb-3 flex gap-2">
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
        {children}
      </div>
    </div>
  );
}
