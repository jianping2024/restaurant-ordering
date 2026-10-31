import { RestaurantPrintSettingsSection } from '@/components/dashboard/print-assistant/RestaurantPrintSettingsSection';
import { loadPrintSettingsPageData } from '@/lib/settings-page-data';
import type { Restaurant } from '@/types';

type Props = {
  restaurantId: string;
  featureFlags: Restaurant['feature_flags'];
  printLocale: Restaurant['print_locale'];
};

/** Server load + sole mount for print settings form on the print-assistant page. */
export async function RestaurantPrintSettingsLoader({
  restaurantId,
  featureFlags,
  printLocale,
}: Props) {
  const data = await loadPrintSettingsPageData(restaurantId, featureFlags, printLocale);
  return (
    <RestaurantPrintSettingsSection
      initialFlags={data.flags}
      initialCredentialTtlDays={data.credentialTtlDays}
      initialStationSlipShowCategoryGroup={data.stationSlipShowCategoryGroup}
      initialPrintLocale={data.printLocale}
    />
  );
}
