import { Suspense } from 'react';
import {
  PrintAgentDownloadSection,
  PrintAgentDownloadSkeleton,
} from '@/components/dashboard/PrintAgentDownloadSection';
import { PrintAssistantLowerSection } from '@/components/dashboard/print-assistant/PrintAssistantLowerSection';
import { PrintAssistantLowerSkeleton } from '@/components/dashboard/print-assistant/PrintAssistantLowerSkeleton';
import { PrintAssistantUpperSection } from '@/components/dashboard/print-assistant/PrintAssistantUpperSection';
import { PrintAssistantUpperSkeleton } from '@/components/dashboard/print-assistant/PrintAssistantUpperSkeleton';
import { RestaurantPrintSettingsLoader } from '@/components/dashboard/print-assistant/RestaurantPrintSettingsLoader';
import { getServerLanguage } from '@/lib/i18n.server';
import { requireRestaurantForSettingsPermission } from '@/lib/settings-page-data';
import type { PermissionKey } from '@/lib/permissions/registry';

export default async function PrintAssistantSettingsPage() {
  const permission: PermissionKey = 'settings.print_assistant.manage';
  const restaurant = await requireRestaurantForSettingsPermission(permission);
  const lang = getServerLanguage();

  return (
    <div className="space-y-6">
      <RestaurantPrintSettingsLoader
        restaurantId={restaurant.id}
        featureFlags={restaurant.feature_flags}
        printLocale={restaurant.print_locale}
      />
      <Suspense fallback={<PrintAssistantUpperSkeleton />}>
        <PrintAssistantUpperSection restaurantId={restaurant.id} />
      </Suspense>
      <Suspense fallback={<PrintAgentDownloadSkeleton />}>
        <PrintAgentDownloadSection />
      </Suspense>
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
