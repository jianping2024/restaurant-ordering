'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { StoreList, enterStore } from '@/components/store-picker/StoreList';
import { MultiStoreOverviewEntryCard } from '@/components/multi-store-overview/MultiStoreOverviewEntry';
import { StoreLessHeader } from '@/components/store-picker/StoreLessHeader';
import { STORE_PICKER_MESSAGES } from '@/lib/i18n/store-picker-messages';
import type { AuthorizedRestaurant } from '@/lib/permissions/restaurant-access-rules';
import {
  STORE_PICKER_CARD_MAX,
  storeDisplayName,
  storeIsSuspended,
} from '@/lib/store-list-model';

const PILL = 'rounded-full border px-2 py-0.5 text-xs';

/**
 * Store picker page body (plan §8.1): ≤6 stores as cards, more as the sole searchable
 * `StoreList`. Entering navigates to the store's landing page (middleware records it as
 * the last store). With enterable stores (≥2 here) the multi-store overview card sits last.
 */
export function StorePickerScreen({
  stores,
  userId,
  hasEnterable,
  lastRestaurantId,
}: {
  stores: AuthorizedRestaurant[];
  userId: string;
  hasEnterable: boolean;
  lastRestaurantId: string | null;
}) {
  const { lang } = useLanguage();
  const t = STORE_PICKER_MESSAGES[lang];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <StoreLessHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
        <div>
          <h1 className="text-2xl font-medium">{t.pageTitle}</h1>
          <p className="mt-1 text-sm text-brand-text-muted">
            {t.pageSubtitle.replace('{count}', String(stores.length))}
          </p>
        </div>
        {!hasEnterable ? (
          <p role="status" className="rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-text-muted">
            {t.noEnterable}
          </p>
        ) : null}
        {stores.length <= STORE_PICKER_CARD_MAX ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {stores.map((store) => {
              const suspended = storeIsSuspended(store);
              return (
                <li key={store.id}>
                  <button
                    type="button"
                    disabled={suspended}
                    onClick={() => enterStore(userId, store)}
                    className="flex min-h-24 w-full flex-col items-start gap-2 rounded-2xl border border-brand-border bg-brand-card p-4 text-left transition-colors hover:border-brand-gold disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-brand-border"
                  >
                    <span className="text-lg font-medium">{storeDisplayName(store)}</span>
                    <span className="flex flex-wrap gap-2">
                      {store.roleName ? (
                        <span className={`${PILL} border-brand-border text-brand-text-muted`}>
                          {t.myRole.replace('{role}', store.roleName)}
                        </span>
                      ) : null}
                      {suspended ? (
                        <span className={`${PILL} border-status-danger/40 text-status-danger`}>{t.suspended}</span>
                      ) : null}
                      {store.id === lastRestaurantId ? (
                        <span className={`${PILL} border-brand-gold/50 text-brand-gold`}>{t.lastVisited}</span>
                      ) : null}
                    </span>
                    {store.city ? <span className="text-xs text-brand-text-muted">{store.city}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-brand-border bg-brand-card p-3">
            <StoreList stores={stores} userId={userId} autoFocus scrollClassName="max-h-[56vh]" />
          </div>
        )}
        {hasEnterable ? <MultiStoreOverviewEntryCard /> : null}
      </main>
    </div>
  );
}
