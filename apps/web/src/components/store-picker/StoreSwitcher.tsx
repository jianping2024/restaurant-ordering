'use client';

import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { MultiStoreOverviewEntryRow } from '@/components/multi-store-overview/MultiStoreOverviewEntry';
import { DashboardTopBarDropdownPanel } from '@/components/dashboard/DashboardTopBarDropdownPanel';
import { StoreList } from '@/components/store-picker/StoreList';
import { ProductTopBarRestaurantName } from '@/components/ui/ProductTopBarRestaurantName';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { MULTI_STORE_OVERVIEW_PATH } from '@/lib/dashboard-store-routes';
import { STORE_PICKER_MESSAGES } from '@/lib/i18n/store-picker-messages';
import type { AuthorizedRestaurant } from '@/lib/permissions/restaurant-access-rules';

/**
 * Top-bar store name as a switcher (plan §8.2) — only mounted when the account can enter
 * ≥2 stores. Opens the sole `StoreList` (search focused, list ≤60vh) with the multi-store
 * overview entry fixed below it (hidden on that page). On the overview page there is no
 * current store (`currentRestaurantId` null).
 */
export function StoreSwitcher({
  restaurantName,
  currentRestaurantId,
  stores,
  userId,
}: {
  restaurantName: string;
  currentRestaurantId: string | null;
  stores: readonly AuthorizedRestaurant[];
  userId: string;
}) {
  const { lang } = useLanguage();
  const t = STORE_PICKER_MESSAGES[lang];
  const [open, setOpen] = useState(false);
  const onOverview = usePathname() === MULTI_STORE_OVERVIEW_PATH;
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} className="relative flex min-w-0 max-lg:flex-1">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t.switchStore}: ${restaurantName}`}
        title={t.switchStore}
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-0 flex-1 items-center gap-1 rounded-md text-left"
      >
        <ProductTopBarRestaurantName name={restaurantName} />
        <span className="shrink-0 text-[10px] text-brand-text-muted" aria-hidden>
          ▾
        </span>
      </button>
      <DashboardTopBarDropdownPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={rootRef}
        mobilePortal
        align="start"
      >
        <div className="w-full p-2 sm:w-[380px]">
          <StoreList
            stores={stores}
            userId={userId}
            currentRestaurantId={currentRestaurantId}
            autoFocus
            scrollClassName="max-h-[60vh]"
            onClose={() => setOpen(false)}
          />
          {onOverview ? null : <MultiStoreOverviewEntryRow onNavigate={() => setOpen(false)} />}
        </div>
      </DashboardTopBarDropdownPanel>
    </div>
  );
}
