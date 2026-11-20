import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { MenuManager } from '@/components/dashboard/MenuManager';
import { loadDashboardMenu } from '@/lib/dashboard-menu';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';
import {
  resolveAllowedMenuManagerTab,
  type MenuManagerTab,
} from '@/lib/menu-manager-tab-preference';

interface Props {
  params: { slug: string };
  searchParams: Promise<{ tab?: string }>;
}

export default async function MenuPage({ params, searchParams }: Props) {
  const { tab } = await searchParams;
  const store = await requireDashboardStore(params.slug);
  const loaded = await loadDashboardMenu(store.restaurant.id);
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
        canManageDishVideo={loaded.canManageDishVideo}
        dishVideoPro={loaded.dishVideoPro}
        flavorHintsEnabled={loaded.flavorHintsEnabled}
        takeawayOrderingEnabled={loaded.takeawayOrderingEnabled}
        restaurantId={loaded.restaurantId}
        initialItems={loaded.menuItems}
        initialCategories={loaded.menuCategories}
        initialPrintStations={loaded.printStations}
        initialRecommendedItemIds={loaded.recommendedItemIds}
        initialNotePresetGroups={loaded.notePresetGroups}
        initialNotePresets={loaded.notePresets}
        initialChoiceGroups={loaded.choiceGroups}
        initialChoiceOptions={loaded.choiceOptions}
        menuTimeSlots={loaded.menuTimeSlots}
        initialMenuItemBuffetPrices={loaded.menuItemBuffetPrices}
        buffets={loaded.buffets}
      />
    </Suspense>
  );
}
