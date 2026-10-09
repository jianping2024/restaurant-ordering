'use client';

import type { ReactNode } from 'react';
import { CustomerStorefrontBand } from '@/components/menu/CustomerStorefrontBand';
import {
  buildCustomerStorefrontBandModel,
  customerStorefrontShouldShow,
  type CustomerStorefrontRestaurantFields,
} from '@/lib/customer-storefront-model';
import type { Language } from '@/types';

type Props = {
  restaurant: CustomerStorefrontRestaurantFields;
  lang: Language;
  /** When false, render children only (staff-assisted / embedded / no profile). */
  enabled: boolean;
  children: ReactNode;
};

/**
 * Guest page: full-bleed storefront + menu share one vertical scroll.
 * Header stays outside (caller). Sole mount gate: {@link customerStorefrontShouldShow}.
 */
export function CustomerMenuStorefrontScroll({
  restaurant,
  lang,
  enabled,
  children,
}: Props) {
  const show = enabled && customerStorefrontShouldShow(restaurant);
  if (!show) return <>{children}</>;

  const model = buildCustomerStorefrontBandModel(restaurant);
  return (
    <div
      data-mesa-storefront-menu-scroll
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain"
    >
      <CustomerStorefrontBand model={model} lang={lang} />
      {children}
    </div>
  );
}

export function customerMenuCategoryScrollModeForStorefront(
  enabled: boolean,
  restaurant: CustomerStorefrontRestaurantFields,
): 'pane' | 'page' {
  return enabled && customerStorefrontShouldShow(restaurant) ? 'page' : 'pane';
}
