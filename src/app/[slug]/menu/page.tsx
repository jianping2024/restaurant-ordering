import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MenuPage } from '@/components/menu/MenuPage';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
}

export default async function CustomerMenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table } = await searchParams;
  const requestedTableNumber = parseInt(table || '1', 10) || 1;

  const supabase = await createClient();

  // 查询餐厅
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug, logo_url')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  let tableNumber = requestedTableNumber;
  const { data: activeSession } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('table_number', requestedTableNumber)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeSession) {
    // If this table was merged into another active table, route ordering to the merged target.
    const { data: mergedFromSession } = await supabase
      .from('table_sessions')
      .select('merge_into_session_id')
      .eq('restaurant_id', restaurant.id)
      .eq('table_number', requestedTableNumber)
      .eq('status', 'closed')
      .eq('closed_reason', 'merged')
      .not('merge_into_session_id', 'is', null)
      .order('closed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (mergedFromSession?.merge_into_session_id) {
      const { data: targetSession } = await supabase
        .from('table_sessions')
        .select('table_number, status')
        .eq('id', mergedFromSession.merge_into_session_id)
        .in('status', ['open', 'billing'])
        .maybeSingle();

      if (targetSession?.table_number) {
        tableNumber = targetSession.table_number;
      }
    }
  }

  // 查询菜单（只返回上架菜品）
  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('category')
    .order('sort_order');

  return (
    <MenuPage
      restaurant={restaurant}
      menuItems={menuItems || []}
      tableNumber={tableNumber}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name')
    .eq('slug', slug)
    .single();

  return {
    title: restaurant ? `${restaurant.name} — 菜单` : '菜单',
  };
}
