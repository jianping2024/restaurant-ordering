import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerRestaurant, resolveCustomerTableContext } from '@/lib/customer-session-context';
import { MenuPage } from '@/components/menu/MenuPage';

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
  const restaurant = await loadCustomerRestaurant(admin, slug);
  if (!restaurant) notFound();

  const tableContext = await resolveCustomerTableContext({
    admin,
    restaurantId: restaurant.id,
    tableIdParam,
  });
  if (!tableContext) notFound();

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

  const defaultWaiterPath = `/${slug}/waiter`;
  const returnToWaiterHref =
    from === 'waiter'
      ? (returnPath && returnPath.startsWith(defaultWaiterPath) ? returnPath : defaultWaiterPath)
      : null;

  return (
    <MenuPage
      restaurant={restaurant}
      menuItems={menuItems || []}
      menuCategories={menuCategories || []}
      tableId={tableContext.tableId}
      displayName={tableContext.displayName}
      returnToWaiterHref={returnToWaiterHref}
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
