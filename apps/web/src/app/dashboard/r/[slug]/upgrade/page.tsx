import { isPremiumKey } from '@mesa/shared';
import { PremiumUpgradePanel } from '@/components/dashboard/PremiumUpgradePanel';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';

type PageProps = {
  params: { slug: string };
  searchParams: Promise<{ feature?: string }>;
};

export default async function PremiumUpgradePage({ params: route, searchParams }: PageProps) {
  await requireDashboardStore(route.slug);

  const params = await searchParams;
  const rawFeature = params.feature?.trim() ?? '';
  const feature = isPremiumKey(rawFeature) ? rawFeature : 'value_analytics';

  return <PremiumUpgradePanel feature={feature} />;
}
