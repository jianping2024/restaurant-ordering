import { loadOverviewDashboardContext } from '@/lib/dashboard-access';
import { DashboardPageClient } from '@/components/dashboard/DashboardPageClient';
import { getServerLanguage } from '@/lib/i18n.server';
import { formatOrderDateTime, formatOverviewDate } from '@/lib/format-dashboard-date';
import { loadDashboardOverviewData } from '@/lib/dashboard-overview';

// 数据概览（数据服务端获取，文案与 LanguageProvider 同步）
export default async function DashboardPage() {
  const ctx = await loadOverviewDashboardContext();
  if ('error' in ctx) return null;

  const { data: restaurant } = await ctx.admin
    .from('restaurants')
    .select('id')
    .eq('id', ctx.restaurantId)
    .single();

  if (!restaurant) return null;

  const lang = getServerLanguage();
  const overview = await loadDashboardOverviewData(ctx.admin, restaurant.id, lang);

  return (
    <DashboardPageClient
      overviewDateLabel={formatOverviewDate(lang)}
      todayKpis={overview.todayKpis}
      pendingActions={overview.pendingActions}
      topItems={overview.topItems}
      recentOrders={overview.recentOrders.map((order) => ({
        ...order,
        createdAtLabel: formatOrderDateTime(lang, order.created_at),
      }))}
      feedback={overview.feedback}
    />
  );
}
