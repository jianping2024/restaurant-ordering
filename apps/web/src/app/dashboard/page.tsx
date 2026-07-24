import { loadOverviewDashboardContext } from '@/lib/dashboard-access';
import { DashboardPageClient } from '@/components/dashboard/DashboardPageClient';
import { loadDashboardOverviewView } from '@/lib/dashboard-overview';

export const dynamic = 'force-dynamic';

// 数据概览：服务端产出 DashboardOverviewView；客户端只按语言格式化展示
export default async function DashboardPage() {
  const ctx = await loadOverviewDashboardContext();
  if ('error' in ctx) return null;

  const overview = await loadDashboardOverviewView(ctx.admin, ctx.restaurantId);

  return <DashboardPageClient overview={overview} />;
}
