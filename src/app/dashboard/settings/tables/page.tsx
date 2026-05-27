import { notFound } from 'next/navigation';
import { TablesManager } from '@/components/dashboard/TablesManager';
import { loadOwnerDashboardTables } from '@/lib/dashboard-tables';

export default async function SettingsTablesPage() {
  const loaded = await loadOwnerDashboardTables();
  if ('error' in loaded) {
    notFound();
  }

  return (
    <TablesManager
      embedded
      restaurant={loaded.restaurant}
      initialTables={loaded.tables}
    />
  );
}
