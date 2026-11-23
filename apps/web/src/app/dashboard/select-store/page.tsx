import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { StorePickerScreen } from '@/components/store-picker/StorePickerScreen';
import { DASHBOARD_ENTRY_PATH } from '@/lib/dashboard-store-routes';
import { LAST_RESTAURANT_COOKIE, parseLastRestaurantCookie } from '@/lib/last-restaurant-cookie';
import { listAuthorizedRestaurantsForUser } from '@/lib/permissions/restaurant-access';
import { restaurantIsEnterable } from '@/lib/permissions/restaurant-access-rules';
import { loadAuthUserWithAdmin } from '@/lib/staff-access';

export const dynamic = 'force-dynamic';

/**
 * Store picker (multi-store plan §8.1). Only multi-store accounts stay here: one enterable
 * store → straight in; nothing listed → store-less entry (login / onboarding). With no
 * enterable store but suspended ones listed, the page shows them greyed with a notice.
 */
export default async function SelectStorePage() {
  const auth = await loadAuthUserWithAdmin();
  if (!auth) redirect('/auth/login');

  const stores = await listAuthorizedRestaurantsForUser(auth.user.id);
  if (stores.length === 0) redirect(DASHBOARD_ENTRY_PATH);
  const enterable = stores.filter(restaurantIsEnterable);
  if (enterable.length === 1) redirect(enterable[0].landingPath);

  return (
    <StorePickerScreen
      stores={stores}
      userId={auth.user.id}
      hasEnterable={enterable.length > 0}
      lastRestaurantId={parseLastRestaurantCookie(
        cookies().get(LAST_RESTAURANT_COOKIE)?.value,
        auth.user.id,
      )}
    />
  );
}
