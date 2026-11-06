'use client';

import { CustomerFullscreenNotice } from '@/components/customer/CustomerFullscreenNotice';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

type Props = {
  restaurantName: string;
  reason?: string | null;
};

export function RestaurantMaintenancePage({ restaurantName, reason }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).customer;

  return (
    <CustomerFullscreenNotice
      title={restaurantName}
      body={t.maintenanceUnavailable}
      detail={reason}
    />
  );
}
