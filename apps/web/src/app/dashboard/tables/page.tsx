import { notFound } from 'next/navigation';
import { TablesManager } from '@/components/dashboard/TablesManager';
import { loadOwnerDashboardTables } from '@/lib/dashboard-tables';

export default async function TablesPage() {
  const loaded = await loadOwnerDashboardTables();
  if ('error' in loaded) {
    notFound();
  }

  return (
    <TablesManager
      restaurant={loaded.restaurant}
      initialTables={loaded.tables}
    />
  );
}
