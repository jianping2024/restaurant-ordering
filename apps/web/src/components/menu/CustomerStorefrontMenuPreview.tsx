'use client';

import { useMemo, useState } from 'react';
import {
  CustomerStorefrontBand,
  type CustomerStorefrontBandModel,
} from '@/components/menu/CustomerStorefrontBand';
import { CustomerOrderingHeader } from '@/components/menu/CustomerOrderingHeader';
import { CustomerRecommendedRail } from '@/components/menu/CustomerRecommendedRail';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { useLanguage } from '@/components/providers/LanguageProvider';
import {
  CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS,
  customerMenuDualPaneRootClass,
  customerMenuShellRootClass,
} from '@/lib/customer-menu-chrome-layout';
import {
  CUSTOMER_MENU_ITEM_LIST_CLASS,
  CUSTOMER_MENU_ITEM_LIST_HOST_CLASS,
} from '@/lib/menu-item-card-layout';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';
import { getDemoMenuCatalog } from '@/lib/demo-menu-catalog';
import { DEMO_RESTAURANT } from '@/lib/demo-data';
import { getMenuCategoryLabel } from '@/lib/menu-admin';
import {
  customerMenuNavTopCategories,
  resolveCustomerMenuCatalogView,
} from '@/lib/menu-recommended';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';

type Props = {
  model: CustomerStorefrontBandModel;
  displayName?: string;
};

/**
 * Static preview: real header stays pinned; storefront is full-bleed in the
 * same scroll as the menu so上划 literally pushes the band away.
 */
export function CustomerStorefrontMenuPreview({
  model,
  displayName = '5',
}: Props) {
  const { lang } = useLanguage();
  const t = MENU_PAGE_MESSAGES[lang];
  const [activeTop, setActiveTop] = useState('c1');
  const [activeSubpath, setActiveSubpath] = useState('');
  const [cartQty, setCartQty] = useState<Record<string, number>>({});

  const catalog = useMemo(() => getDemoMenuCatalog(), []);
  const view = useMemo(
    () =>
      resolveCustomerMenuCatalogView({
        menuItems: catalog.menuItems,
        menuCategories: catalog.menuCategories,
        recommendedItemIds: catalog.recommendedItemIds,
        activeTopId: activeTop,
        activeSubpath,
      }),
    [catalog, activeTop, activeSubpath],
  );

  const topCategories = customerMenuNavTopCategories(view, (cat) =>
    getMenuCategoryLabel(cat, lang),
  );

  return (
    <div
      className={`${customerMenuDualPaneRootClass} h-dvh ${customerMenuShellRootClass}`}
    >
      <div className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-center text-[11px] text-amber-900 dark:text-amber-200">
        静态预览 · 上划整页菜单，店面装修会被顶走 · 顶栏店名桌号钉住
      </div>

      <CustomerOrderingHeader
        restaurantName={DEMO_RESTAURANT.name}
        displayName={displayName}
        tableLabel={t.table}
        sticky
      />

      {/* One scrollport: storefront + menu. Header stays outside → pinned. */}
      <div
        data-mesa-storefront-menu-scroll
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain"
      >
        <CustomerStorefrontBand model={model} lang={lang} />

        {/* Viewport-tall menu dock so after the band scrolls away, categories fill the screen */}
        <div className="flex min-h-[calc(100dvh-6.5rem)]">
          <nav
            className={[
              CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS,
              'sticky top-0 z-20 flex h-[calc(100dvh-6.5rem)] shrink-0 flex-col overflow-y-auto overscroll-y-contain border-r border-brand-border bg-brand-card/40',
            ].join(' ')}
            aria-label="categories"
          >
            {topCategories.map((cat) => {
              const active = cat.id === view.currentTopId;
              return (
                <button
                  key={cat.id}
                  type="button"
                  title={cat.label}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => {
                    setActiveTop(cat.id);
                    setActiveSubpath('');
                  }}
                  className={[
                    'relative w-full px-1.5 py-3 text-center',
                    CUSTOMER_MENU_TYPE.categoryTop,
                    active
                      ? `bg-brand-bg text-brand-gold ${CUSTOMER_MENU_TYPE.categoryTopActive}`
                      : 'text-brand-text-muted hover:text-brand-text',
                  ].join(' ')}
                >
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute inset-y-[20%] left-0 w-[3px] rounded-r-sm bg-brand-gold"
                    />
                  ) : null}
                  <span className="line-clamp-2 break-words [overflow-wrap:anywhere]">
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </nav>

          <div
            className={`${CUSTOMER_MENU_ITEM_LIST_HOST_CLASS} min-w-0 flex-1 px-3 pb-8 pt-4`}
          >
            <CustomerRecommendedRail
              items={view.recommendedItems}
              lang={lang}
              title={t.recommended}
              onOpenDetail={() => {}}
            />
            <div className={CUSTOMER_MENU_ITEM_LIST_CLASS}>
              {view.currentItems.map((item) => {
                const qty = cartQty[item.id] ?? 0;
                return (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    lang={lang}
                    cartQty={qty}
                    onOpenDetail={() => {}}
                    onIncrement={() =>
                      setCartQty((prev) => ({
                        ...prev,
                        [item.id]: (prev[item.id] ?? 0) + 1,
                      }))
                    }
                    onDecrement={() =>
                      setCartQty((prev) => ({
                        ...prev,
                        [item.id]: Math.max(0, (prev[item.id] ?? 0) - 1),
                      }))
                    }
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
