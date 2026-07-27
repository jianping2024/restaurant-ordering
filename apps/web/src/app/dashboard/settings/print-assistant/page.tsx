import { Suspense } from 'react';
import {
  PrintAgentDownloadSection,
  PrintAgentDownloadSkeleton,
} from '@/components/dashboard/PrintAgentDownloadSection';
import { PrintAssistantLowerSection } from '@/components/dashboard/print-assistant/PrintAssistantLowerSection';
import { PrintAssistantLowerSkeleton } from '@/components/dashboard/print-assistant/PrintAssistantLowerSkeleton';
import { PrintAssistantUpperSection } from '@/components/dashboard/print-assistant/PrintAssistantUpperSection';
import { PrintAssistantUpperSkeleton } from '@/components/dashboard/print-assistant/PrintAssistantUpperSkeleton';
import { getServerLanguage } from '@/lib/i18n.server';
import { requireOwnerRestaurant } from '@/lib/settings-page-data';
import { getSiteOrigin } from '@/lib/site-origin';

export default async function PrintAssistantSettingsPage() {
  const restaurant = await requireOwnerRestaurant();
  const lang = getServerLanguage();
  const siteOrigin = getSiteOrigin();

  return (
    <div className="space-y-6">
      <Suspense fallback={<PrintAssistantUpperSkeleton />}>
        <PrintAssistantUpperSection restaurantId={restaurant.id} />
      </Suspense>
      {siteOrigin ? (
        <Suspense fallback={<PrintAgentDownloadSkeleton />}>
          <PrintAgentDownloadSection siteOrigin={siteOrigin} />
        </Suspense>
      ) : null}
      <Suspense fallback={<PrintAssistantLowerSkeleton />}>
        <PrintAssistantLowerSection
          restaurantId={restaurant.id}
          restaurantSlug={restaurant.slug}
          lang={lang}
        />
      </Suspense>
    </div>
  );
}
