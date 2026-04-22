import { createClient } from '@/lib/supabase/server';
import { MenuManager } from '@/components/dashboard/MenuManager';

// 菜单管理页（Server Component，负责数据获取）
export default async function MenuPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user!.id)
    .single();

  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurant!.id)
    .order('category')
    .order('sort_order');

  return (
    <MenuManager
      restaurantId={restaurant!.id}
      initialItems={menuItems || []}
    />
  );
}
