import { DASHBOARD_NAV_ITEMS } from '@/lib/dashboard-feature-registry';
import type { StaffPersonalTopNavItem } from '@/lib/staff-personal-top-nav';
import { waiterBoardHref } from '@/lib/staff-routes';

export function buildWaiterStandaloneTopNav(slug: string): StaffPersonalTopNavItem[] {
  const board = DASHBOARD_NAV_ITEMS.waiterBoard;
  const href = waiterBoardHref(slug);
  return [
    {
      id: board.id,
      href,
      labelKey: board.key,
      icon: board.icon,
      matchPrefix: href,
    },
  ];
}

export function waiterStandaloneLogoHref(slug: string): string {
  return waiterBoardHref(slug);
}
