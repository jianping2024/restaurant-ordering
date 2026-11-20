import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { TablesManager } from '@/components/dashboard/TablesManager';
import { loadDashboardTables } from '@/lib/dashboard-tables';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';
import { getPublicWebOrigin } from '@/lib/site-origin';
import { parseTablesManagerTab } from '@/lib/tables-manager-tab-preference';

interface Props {
  params: { slug: string };
  searchParams: Promise<{ tab?: string }>;
}

export default async function TablesPage({ params, searchParams }: Props) {
  const { tab } = await searchParams;
  const initialTab = parseTablesManagerTab(tab);
  const store = await requireDashboardStore(params.slug);
  const loaded = await loadDashboardTables(store.restaurant.id);
  if ('error' in loaded) {
    notFound();
  }

  return (
    <TablesManager
      restaurant={loaded.restaurant}
      initialTables={loaded.tables}
      initialGroups={loaded.groups}
      initialMembers={loaded.members}
      initialOccupiedTableIds={loaded.occupiedTableIds}
      initialTab={initialTab}
      webOrigin={getPublicWebOrigin(headers())}
    />
  );
}
