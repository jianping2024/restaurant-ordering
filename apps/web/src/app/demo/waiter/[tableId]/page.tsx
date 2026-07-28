import { notFound } from 'next/navigation';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import { DEMO_ORDERS, DEMO_RESTAURANT, DEMO_TABLES } from '@/lib/demo-data';
import { demoPageMetadata } from '@/lib/demo-page-metadata';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { floorBoardCapabilitiesFromCaps } from '@/lib/permissions/resolve';
import { capabilitiesFromKeys } from '@/lib/permissions/can';
import { ROLE_TEMPLATES } from '@/lib/permissions/role-templates';

interface Props {
  params: Promise<{ tableId: string }>;
}

export const metadata = demoPageMetadata('Demo Waiter — Table');

export default async function DemoWaiterTablePage({ params }: Props) {
  const { tableId: tableIdParam } = await params;
  const tableId = parseTableIdParam(tableIdParam);
  const table = DEMO_TABLES.find((t) => t.id === tableId);
  if (!tableId || !table) {
    notFound();
  }

  const capabilities = capabilitiesFromKeys([...ROLE_TEMPLATES.waiter]);
  const floorCapabilities = floorBoardCapabilitiesFromCaps(capabilities);

  return (
    <WaiterTableDetail
      restaurant={{
        id: DEMO_RESTAURANT.id,
        name: DEMO_RESTAURANT.name,
        slug: DEMO_RESTAURANT.slug,
      }}
      tables={DEMO_TABLES}
      initialOrders={DEMO_ORDERS}
      tableId={table.id}
      displayName={table.display_name}
      isDemo
      floorCapabilities={floorCapabilities}
      capabilities={capabilities}
    />
  );
}
