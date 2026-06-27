import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { MenuManager } from '@/components/dashboard/MenuManager';
import { loadDashboardMenu } from '@/lib/dashboard-menu';
import {
  isMenuManagerTab,
  MENU_MANAGER_DEFAULT_TAB,
  type MenuManagerTab,
} from '@/lib/menu-manager-tab-preference';

function parseMenuTab(tab: string | undefined): MenuManagerTab {
  if (isMenuManagerTab(tab)) return tab;
  return MENU_MANAGER_DEFAULT_TAB;
}

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function MenuPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const initialTab = parseMenuTab(tab);
  const loaded = await loadDashboardMenu();
  if ('error' in loaded) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <MenuManager
        initialTab={initialTab}
        restaurantId={loaded.restaurantId}
        initialItems={loaded.menuItems}
        initialCategories={loaded.menuCategories}
        initialPrintStations={loaded.printStations}
      />
    </Suspense>
  );
}
