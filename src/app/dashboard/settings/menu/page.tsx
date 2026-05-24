import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { MenuManager } from '@/components/dashboard/MenuManager';
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

export default async function SettingsMenuPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const initialTab = parseMenuTab(tab);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user!.id)
    .single();

  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurant!.id)
    .order('category_id')
    .order('sort_order');

  const { data: menuCategories } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('restaurant_id', restaurant!.id)
    .eq('active', true)
    .order('sort_order');

  const { data: printStations } = await supabase
    .from('print_stations')
    .select('*')
    .eq('restaurant_id', restaurant!.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  return (
    <Suspense fallback={null}>
      <MenuManager
        embedded
        initialTab={initialTab}
        restaurantId={restaurant!.id}
        initialItems={menuItems || []}
        initialCategories={menuCategories || []}
        initialPrintStations={printStations ?? []}
      />
    </Suspense>
  );
}
