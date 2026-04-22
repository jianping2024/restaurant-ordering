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
  const tableNumber = parseInt(table || '1', 10) || 1;

  const supabase = await createClient();

  // 查询餐厅
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug, logo_url')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

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
