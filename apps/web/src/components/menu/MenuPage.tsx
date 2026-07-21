'use client';

import { useEffect } from 'react';
import { seedCustomerMenuCatalogCache } from '@/lib/customer-menu-catalog-client-cache';
import type { CustomerSessionContext } from '@/lib/customer-session-context';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import type { CartItem, MenuCategory, MenuItem } from '@/types';
import {
  MenuOrderingController,
  type MenuOrderingRestaurant,
} from '@/components/menu/MenuOrderingController';

interface Props {
  restaurant: MenuOrderingRestaurant;
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  tableId: string;
  displayName: string;
  orderCooldownSeconds: number;
  initialSessionContext?: CustomerSessionContext | null;
  isDemo?: boolean;
  staffAssisted?: StaffAssistedFlow | null;
}

export function MenuPage({
  restaurant,
  menuItems,
  menuCategories,
  tableId,
  displayName,
  orderCooldownSeconds,
  initialSessionContext = null,
  isDemo,
  staffAssisted = null,
}: Props) {
  useEffect(() => {
    seedCustomerMenuCatalogCache(restaurant.id, { menuItems, menuCategories });
  }, [menuCategories, menuItems, restaurant.id]);

  return (
    <MenuOrderingController
      restaurant={restaurant}
      menuItems={menuItems}
      menuCategories={menuCategories}
      tableId={tableId}
      displayName={displayName}
      orderCooldownSeconds={orderCooldownSeconds}
      initialSessionContext={initialSessionContext}
      isDemo={isDemo}
      staffAssisted={staffAssisted}
      presentationMode="page"
      staffSubmitMode={staffAssisted ? 'navigate' : 'navigate'}
    />
  );
}

export type { CartItem };
