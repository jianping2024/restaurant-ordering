import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { MenuManager } from '@/components/dashboard/MenuManager';
import { loadDashboardMenu } from '@/lib/dashboard-menu';
import {
  resolveAllowedMenuManagerTab,
  type MenuManagerTab,
} from '@/lib/menu-manager-tab-preference';

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function MenuPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const loaded = await loadDashboardMenu();
  if ('error' in loaded) {
    notFound();
  }

  const initialTab: MenuManagerTab = resolveAllowedMenuManagerTab(
    tab,
    loaded.canManagePrintStations,
  );

  return (
    <Suspense fallback={null}>
      <MenuManager
        initialTab={initialTab}
        canManagePrintStations={loaded.canManagePrintStations}
        restaurantId={loaded.restaurantId}
        initialItems={loaded.menuItems}
        initialCategories={loaded.menuCategories}
        initialPrintStations={loaded.printStations}
      />
    </Suspense>
  );
}
