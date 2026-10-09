'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  CUSTOMER_MENU_SUBCATEGORY_STICKY_PAGE_SCROLL_CLASS,
  CUSTOMER_MENU_SUBCATEGORY_STICKY_SHELL_CLASS,
  customerMenuCatalogPaneClass,
  customerMenuCatalogPanePageScrollClass,
  customerMenuCategoryNavShellClass,
  customerMenuCategoryNavShellPageScrollClass,
  customerMenuCategoryRailClass,
  customerMenuCategoryRailPageScrollClass,
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

/** `pane` = nested dual scroll (default). `page` = outer storefront scroll owns vertical scroll. */
export type CustomerMenuCategoryScrollMode = 'pane' | 'page';

type Props = {
  topCategories: CustomerMenuCategoryOption[];
  activeTopId: string;
  onSelectTop: (id: string) => void;
  subCategories: CustomerMenuCategoryOption[];
  activeSubpath: string;
  onSelectSubpath: (id: string) => void;
  subcategoryAllLabel: string;
  /**
   * Right-column block above sub chips (sole slot for CustomerRecommendedRail).
   * Catalog order is always: catalogLeading → sticky sub chips → children (dish list).
   */
  catalogLeading?: ReactNode;
  /** Default `pane`. Use `page` when a full-bleed storefront shares one scroll above. */
  scrollMode?: CustomerMenuCategoryScrollMode;
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
 * right column order catalogLeading (recommended) → sticky soft sub chips →
 * children (dish list). Default dual independent scrollports; `scrollMode="page"`
 * for storefront+menu one-scroll. Filter-on-select (no scroll-spy).
 */
export function CustomerMenuCategoryNav({
  topCategories,
  activeTopId,
  onSelectTop,
  subCategories,
  activeSubpath,
  onSelectSubpath,
  subcategoryAllLabel,
  catalogLeading = null,
  scrollMode = 'pane',
  children,
}: Props) {
  const railRef = useRef<HTMLElement>(null);
  const pageScroll = scrollMode === 'page';

  useLayoutEffect(() => {
    const selected = railRef.current?.querySelector(
      `[data-category-id="${CSS.escape(activeTopId)}"]`,
    );
    selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTopId]);

  return (
    <div
      className={
        pageScroll
          ? customerMenuCategoryNavShellPageScrollClass
          : customerMenuCategoryNavShellClass
      }
    >
      <nav
        ref={railRef}
        className={
          pageScroll ? customerMenuCategoryRailPageScrollClass : customerMenuCategoryRailClass
        }
        aria-label="categories"
      >
        {topCategories.map((cat) => {
          const active = cat.id === activeTopId;
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

      <div
        data-mesa-menu-catalog-pane
        className={`${CUSTOMER_MENU_ITEM_LIST_HOST_CLASS} ${
          pageScroll ? customerMenuCatalogPanePageScrollClass : customerMenuCatalogPaneClass
        }`}
      >
        {catalogLeading}
        {subCategories.length > 0 ? (
          <div
            className={
              pageScroll
                ? CUSTOMER_MENU_SUBCATEGORY_STICKY_PAGE_SCROLL_CLASS
                : CUSTOMER_MENU_SUBCATEGORY_STICKY_SHELL_CLASS
            }
            role="toolbar"
            aria-label="subcategories"
          >
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
