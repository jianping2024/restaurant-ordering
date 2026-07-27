import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { PrintAssistantLowerSection } from '@/components/dashboard/print-assistant/PrintAssistantLowerSection';
import { PrintAssistantLowerSkeleton } from '@/components/dashboard/print-assistant/PrintAssistantLowerSkeleton';
import { PrintAssistantUpperSection } from '@/components/dashboard/print-assistant/PrintAssistantUpperSection';
import { PrintAssistantUpperSkeleton } from '@/components/dashboard/print-assistant/PrintAssistantUpperSkeleton';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import { getServerLanguage } from '@/lib/i18n.server';
import { getSiteOrigin } from '@/lib/site-origin';

export default async function PrintAssistantSettingsPage() {
  const access = await getDashboardAccess();
  if (access.mode === 'unauthenticated') redirect('/auth/login');
  if (access.mode === 'onboarding' || access.mode === 'access_error') redirect('/dashboard');

  const restaurant = access.restaurant;
  const lang = getServerLanguage();
  const siteOrigin = getSiteOrigin();

  return (
    <div className="space-y-6">
      <Suspense fallback={<PrintAssistantUpperSkeleton />}>
        <PrintAssistantUpperSection restaurantId={restaurant.id} />
      </Suspense>
      {siteOrigin ? (
        <Suspense fallback={<PrintAssistantLowerSkeleton />}>
          <PrintAssistantLowerSection
            restaurantId={restaurant.id}
            restaurantSlug={restaurant.slug}
            lang={lang}
            siteOrigin={siteOrigin}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
