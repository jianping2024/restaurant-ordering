import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { TablesManager } from '@/components/dashboard/TablesManager';
import { loadDashboardTables } from '@/lib/dashboard-tables';
import { getPublicWebOrigin } from '@/lib/site-origin';
import { parseTablesManagerTab } from '@/lib/tables-manager-tab-preference';

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function TablesPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const initialTab = parseTablesManagerTab(tab);
  const loaded = await loadDashboardTables();
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
