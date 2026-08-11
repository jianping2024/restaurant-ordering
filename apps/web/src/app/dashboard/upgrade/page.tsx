import { redirect } from 'next/navigation';
import { isPremiumKey } from '@mesa/shared';
import { PremiumUpgradePanel } from '@/components/dashboard/PremiumUpgradePanel';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';

type PageProps = {
  searchParams: Promise<{ feature?: string }>;
};

export default async function PremiumUpgradePage({ searchParams }: PageProps) {
  const access = await getDashboardAccess();
  if (access.mode === 'unauthenticated') {
    redirect('/auth/login');
  }
  if (access.mode === 'onboarding' || access.mode === 'access_error') {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const rawFeature = params.feature?.trim() ?? '';
  const feature = isPremiumKey(rawFeature) ? rawFeature : 'value_analytics';

  return <PremiumUpgradePanel feature={feature} />;
}
