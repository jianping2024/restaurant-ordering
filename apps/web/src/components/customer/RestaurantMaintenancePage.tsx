'use client';

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
    <div className="flex min-h-screen items-center justify-center bg-brand-bg p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-brand-fg">{restaurantName}</h1>
        <p className="mt-4 text-brand-muted">{t.maintenanceUnavailable}</p>
        {reason ? <p className="mt-3 text-sm text-brand-muted/80">{reason}</p> : null}
      </div>
    </div>
  );
}
