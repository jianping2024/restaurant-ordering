import { MenuPage } from '@/components/menu/MenuPage';
import { DEMO_RESTAURANT, DEMO_TABLES, demoTableByDisplayName } from '@/lib/demo-data';
import { getDemoMenuCatalog } from '@/lib/demo-menu-catalog';
import { clampOrderCooldownSeconds } from '@/lib/order-submit-cooldown-client';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { resolveStaffAssistedFlow } from '@/lib/staff-routes';

interface Props {
  searchParams: Promise<{ table_id?: string; from?: string; return?: string }>;
}

export const metadata = {
  title: 'Casa Portuguesa — 菜单演示',
};

export default async function DemoMenuPage({ searchParams }: Props) {
  const { table_id: tableIdParam, from, return: returnPath } = await searchParams;
  const defaultTable = demoTableByDisplayName('5') ?? DEMO_TABLES[4]!;
  const tableId = parseTableIdParam(tableIdParam) ?? defaultTable.id;
  const table = DEMO_TABLES.find((t) => t.id === tableId) ?? defaultTable;
  const { menuItems, menuCategories } = getDemoMenuCatalog();
  const staffAssisted = resolveStaffAssistedFlow(
    from,
    returnPath,
    DEMO_RESTAURANT.slug,
    table.id,
    { isDemo: true },
  );

  return (
    <MenuPage
      restaurant={DEMO_RESTAURANT}
      initialMenuCatalog={{ menuItems, menuCategories }}
      tableId={table.id}
      displayName={table.display_name}
      orderCooldownSeconds={clampOrderCooldownSeconds(undefined)}
      isDemo
      staffAssisted={staffAssisted}
    />
  );
}
