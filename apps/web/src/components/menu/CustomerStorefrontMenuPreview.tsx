'use client';

import { useMemo, useState } from 'react';
import {
  CustomerStorefrontBand,
  type CustomerStorefrontBandModel,
} from '@/components/menu/CustomerStorefrontBand';
import { CustomerMenuCategoryNav } from '@/components/menu/CustomerMenuCategoryNav';
import { CustomerOrderingHeader } from '@/components/menu/CustomerOrderingHeader';
import { CustomerRecommendedRail } from '@/components/menu/CustomerRecommendedRail';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { useLanguage } from '@/components/providers/LanguageProvider';
import {
  customerMenuDualPaneRootClass,
  customerMenuShellRootClass,
} from '@/lib/customer-menu-chrome-layout';
import { CUSTOMER_MENU_ITEM_LIST_CLASS } from '@/lib/menu-item-card-layout';
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
        menuTimeSlotId: null,
        activeTopId: activeTop,
        activeSubpath,
      }),
    [catalog, activeTop, activeSubpath],
  );

  const topCategories = customerMenuNavTopCategories(
    view,
    (cat) => getMenuCategoryLabel(cat, lang),
    Object.entries(cartQty).map(([menuItemId, qty]) => ({ menuItemId, qty })),
  );

  return (
    <div
      className={`${customerMenuDualPaneRootClass} h-dvh ${customerMenuShellRootClass}`}
    >
      <div className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-center text-[11px] text-amber-900 dark:text-amber-200">
        静态预览 · 上划整页菜单，店面装修会被顶走 · 顶栏桌号钉住
      </div>

      <CustomerOrderingHeader
        restaurantName={DEMO_RESTAURANT.name}
        displayName={displayName}
        tableLabel={t.table}
        showRestaurantName={false}
        sticky
      />

      {/* One scrollport: storefront + menu. Header stays outside → pinned. */}
      <div
        data-mesa-storefront-menu-scroll
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain"
      >
        <CustomerStorefrontBand model={model} lang={lang} />

        <CustomerMenuCategoryNav
          scrollMode="page"
          topCategories={topCategories}
          activeTopId={view.currentTopId}
          onSelectTop={(id) => {
            setActiveTop(id);
            setActiveSubpath('');
          }}
          subCategories={[]}
          activeSubpath={activeSubpath}
          onSelectSubpath={setActiveSubpath}
          subcategoryAllLabel={t.subcategoryAll}
          catalogLeading={
            <CustomerRecommendedRail
              items={view.recommendedItems}
              lang={lang}
              title={t.recommended}
              onOpenDetail={() => {}}
            />
          }
        >
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
        </CustomerMenuCategoryNav>
      </div>
    </div>
  );
}
