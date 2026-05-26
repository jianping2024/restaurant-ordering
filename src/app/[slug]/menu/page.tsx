import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MenuPage } from '@/components/menu/MenuPage';
import { parseTableIdParam } from '@/lib/restaurant-tables';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table_id?: string; from?: string; return?: string }>;
}

export default async function CustomerMenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table_id: tableIdParam, from, return: returnPath } = await searchParams;

  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('id, name, slug, logo_url, geo_latitude, geo_longitude, order_radius_meters')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  const { data: activeTables } = await supabase
    .from('restaurant_tables')
    .select('id, display_name, sort_order')
    .eq('restaurant_id', restaurant.id)
    .is('deleted_at', null)
    .order('sort_order');

  const defaultTableId = activeTables?.[0]?.id;
  const requestedTableId = parseTableIdParam(tableIdParam) ?? defaultTableId;
  if (!requestedTableId) notFound();

  let tableId = requestedTableId;
  let displayName =
    activeTables?.find((t) => t.id === requestedTableId)?.display_name ?? requestedTableId.slice(0, 8);

  const { data: activeSession } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('table_id', requestedTableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeSession) {
    const { data: mergedFromSession } = await supabase
      .from('table_sessions')
      .select('merge_into_session_id')
      .eq('restaurant_id', restaurant.id)
      .eq('table_id', requestedTableId)
      .eq('status', 'closed')
      .eq('closed_reason', 'merged')
      .not('merge_into_session_id', 'is', null)
      .order('closed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (mergedFromSession?.merge_into_session_id) {
      const { data: targetSession } = await supabase
        .from('table_sessions')
        .select('table_id, status')
        .eq('id', mergedFromSession.merge_into_session_id)
        .in('status', ['open', 'billing'])
        .maybeSingle();

      if (targetSession?.table_id) {
        tableId = targetSession.table_id;
        displayName =
          activeTables?.find((t) => t.id === tableId)?.display_name ?? displayName;
      }
    }
  }

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
      tableId={tableId}
      displayName={displayName}
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
