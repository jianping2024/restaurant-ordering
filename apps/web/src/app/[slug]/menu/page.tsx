import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RestaurantMaintenancePage } from '@/components/customer/RestaurantMaintenancePage';
import {
  loadCustomerRestaurantGate,
  loadCustomerSessionContext,
} from '@/lib/customer-session-context';
import { MenuPage } from '@/components/menu/MenuPage';
import { resolveStaffAssistedFlow } from '@/lib/staff-routes';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table_id?: string; from?: string; return?: string }>;
}

export default async function CustomerMenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table_id: tableIdParam, from, return: returnPath } = await searchParams;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    notFound();
  }
  const gate = await loadCustomerRestaurantGate(admin, slug);
  if (gate.kind === 'not_found') notFound();
  if (gate.kind === 'suspended') {
    return <RestaurantMaintenancePage restaurantName={gate.name} reason={gate.reason} />;
  }
  const restaurant = gate.restaurant;

  const sessionContext = await loadCustomerSessionContext({
    admin,
    restaurantId: restaurant.id,
    tableIdParam,
  });
  if (!sessionContext) notFound();

  const supabase = await createClient();

  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('category_id')
    .order('sort_order');

  const { data: menuCategories } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('active', true)
    .order('sort_order');

  const staffAssisted = resolveStaffAssistedFlow(
    from,
    returnPath,
    slug,
    sessionContext.table_id,
  );

  return (
    <MenuPage
      restaurant={restaurant}
      menuItems={menuItems || []}
      menuCategories={menuCategories || []}
      tableId={sessionContext.table_id}
      displayName={sessionContext.display_name}
      initialSessionContext={sessionContext}
      staffAssisted={staffAssisted}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('name')
    .eq('slug', slug)
    .single();

  return {
    title: restaurant ? `${restaurant.name} — 菜单` : '菜单',
  };
}
