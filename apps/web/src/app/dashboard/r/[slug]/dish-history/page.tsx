import { redirect } from 'next/navigation';
import { DishHistoryManager } from '@/components/dashboard/DishHistoryManager';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';
import { dashboardStoreHref } from '@/lib/dashboard-store-routes';
import { loadActiveRestaurantTableRows } from '@/lib/load-active-restaurant-tables';
import { can } from '@/lib/permissions/can';
import { getServerLanguage } from '@/lib/i18n.server';
import { getMessages } from '@/lib/i18n/messages';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function DishHistoryPage({ params }: { params: { slug: string } }) {
  const access = await requireDashboardStore(params.slug);
  if (!can(access.loaded.capabilities, 'dashboard.dish_history.view')) {
    redirect(dashboardStoreHref(access.restaurant.slug));
  }

  let tables: RestaurantTableRow[] = [];
  try {
    const admin = createAdminClient();
    const tablesResult = await loadActiveRestaurantTableRows(admin, access.restaurant.id);
    if (tablesResult.ok) tables = tablesResult.tables;
  } catch {
    tables = [];
  }

  const lang = getServerLanguage();
  const title = getMessages(lang).dishHistory.title;

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl text-brand-gold">{title}</h1>
      <DishHistoryManager restaurantSlug={access.restaurant.slug} tables={tables} />
    </div>
  );
}
