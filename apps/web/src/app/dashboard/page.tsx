import { loadOverviewDashboardContext } from '@/lib/dashboard-access';
import { DashboardPageClient } from '@/components/dashboard/DashboardPageClient';
import { loadDashboardOverviewData } from '@/lib/dashboard-overview';

export const dynamic = 'force-dynamic';

// 数据概览：服务端只加载业务数据，展示文案与格式化由客户端 LanguageProvider 驱动
export default async function DashboardPage() {
  const ctx = await loadOverviewDashboardContext();
  if ('error' in ctx) return null;

  const { data: restaurant } = await ctx.admin
    .from('restaurants')
    .select('id')
    .eq('id', ctx.restaurantId)
    .single();

  if (!restaurant) return null;

  const overview = await loadDashboardOverviewData(ctx.admin, restaurant.id);

  return (
    <DashboardPageClient
      todayOrders={overview.todayOrders}
      todayKpis={overview.todayKpis}
      pendingActions={overview.pendingActions}
      recentOrders={overview.recentOrders}
      feedbackInputs={overview.feedbackInputs}
    />
  );
}
