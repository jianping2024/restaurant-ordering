import { createClient } from '@/lib/supabase/server';
import type { Order } from '@/types';
import { getServerLanguage } from '@/lib/i18n.server';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';

// 数据概览页
export default async function DashboardPage() {
  const lang = await getServerLanguage();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user!.id)
    .single();

  if (!restaurant) return null;

  // 今日开始时间
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // 获取今日订单
  const { data: todayOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .gte('created_at', todayStart.toISOString());

  // 获取所有订单（计算统计）
  const { data: allOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: false })
    .limit(10);

  // 获取菜单数
  const { count: menuCount } = await supabase
    .from('menu_items')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurant.id);

  const orders = (todayOrders || []) as Order[];
  const todayRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const doneOrders = orders.filter(o => o.status === 'done').length;

  // 统计热门菜品
  const itemCount: Record<string, { name: string; count: number; emoji: string }> = {};
  orders.forEach(order => {
    order.items.forEach((item) => {
      if (!itemCount[item.name_pt]) {
        itemCount[item.name_pt] = { name: item.name_pt, count: 0, emoji: item.emoji };
      }
      itemCount[item.name_pt].count += item.qty;
    });
  });
  const topItems = Object.values(itemCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const i18n = getMessages(lang).dashboard;
  const locale = UI_LOCALE_BY_LANG[lang];

  const stats = [
    { label: i18n.todayOrders, value: orders.length, unit: i18n.unitOrder, color: 'text-brand-gold' },
    { label: i18n.todayRevenue, value: `€${todayRevenue.toFixed(2)}`, unit: '', color: 'text-green-400' },
    { label: i18n.doneOrders, value: doneOrders, unit: i18n.unitOrder, color: 'text-blue-400' },
    { label: i18n.menuCount, value: menuCount || 0, unit: i18n.unitDish, color: 'text-purple-400' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-brand-text">{i18n.title}</h1>
        <p className="text-brand-text-muted text-sm mt-1">
          {new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(stat => (
          <div key={stat.label} className="bg-brand-card border border-brand-border rounded-2xl p-6">
            <p className="text-brand-text-muted text-[13px] mb-2">{stat.label}</p>
            <p className={`font-heading text-3xl ${stat.color}`}>
              {stat.value}
              {stat.unit && <span className="text-base ml-1 text-brand-text-muted">{stat.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 热门菜品 */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
          <h2 className="font-heading text-xl text-brand-gold mb-4">{i18n.topItems}</h2>
          {topItems.length === 0 ? (
            <p className="text-brand-text-muted text-sm">{i18n.noToday}</p>
          ) : (
            <div className="space-y-3">
              {topItems.map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-brand-text-muted text-sm w-5">{i + 1}</span>
                  <span className="text-xl">{item.emoji}</span>
                  <span className="flex-1 text-sm text-brand-text truncate">{item.name}</span>
                  <span className="text-brand-gold text-sm font-medium">{item.count} {i18n.serving}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 最近订单 */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
          <h2 className="font-heading text-xl text-brand-gold mb-4">{i18n.recent}</h2>
          {(!allOrders || allOrders.length === 0) ? (
            <p className="text-brand-text-muted text-sm">{i18n.noOrders}</p>
          ) : (
            <div className="space-y-3">
              {(allOrders as Order[]).slice(0, 6).map(order => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-brand-border last:border-0">
                  <div>
                    <p className="text-sm text-brand-text">{i18n.table} {order.table_number}</p>
                    <p className="text-[13px] text-brand-text-muted">
                      {new Date(order.created_at).toLocaleString(locale, {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-brand-gold">€{order.total_amount.toFixed(2)}</p>
                    <span className={`text-[13px] px-2 py-0.5 rounded-full ${
                      order.status === 'done' ? 'bg-green-400/15 text-green-400' :
                      order.status === 'cooking' ? 'bg-yellow-400/15 text-yellow-400' :
                      'bg-red-400/15 text-red-400'
                    }`}>
                      {order.status === 'done' ? i18n.done : order.status === 'cooking' ? i18n.cooking : i18n.pending}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
