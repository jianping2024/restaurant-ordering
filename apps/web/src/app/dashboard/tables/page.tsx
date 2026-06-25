import { notFound } from 'next/navigation';
import { TablesManager } from '@/components/dashboard/TablesManager';
import { loadFrontdeskDashboardTables } from '@/lib/dashboard-tables';
import { parseTablesManagerTab } from '@/lib/tables-manager-tab-preference';

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function TablesPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const initialTab = parseTablesManagerTab(tab);
  const loaded = await loadFrontdeskDashboardTables();
  if ('error' in loaded) {
    notFound();
  }

  return (
    <TablesManager
      restaurant={loaded.restaurant}
      initialTables={loaded.tables}
      initialGroups={loaded.groups}
      initialMembers={loaded.members}
      initialTab={initialTab}
    />
  );
}
