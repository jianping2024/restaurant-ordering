import 'server-only';

import { listAuthorizedRestaurantsForUser } from '@/lib/permissions/restaurant-access';
import { accountHasMultiStoreEntry, type StoreSwitchData } from '@/lib/store-list-model';

/**
 * Store switch entry for a store page (plan §8.2, §1): the account's store list when it can
 * enter ≥2 stores, else null (single-store accounts and the admin account see no switch).
 */
export async function loadStoreSwitchData(principal: {
  kind: 'owner' | 'staff';
  userId: string;
}): Promise<StoreSwitchData | null> {
  if (principal.kind !== 'staff') return null;
  const stores = await listAuthorizedRestaurantsForUser(principal.userId);
  if (!accountHasMultiStoreEntry(stores)) return null;
  return { stores, userId: principal.userId };
}
