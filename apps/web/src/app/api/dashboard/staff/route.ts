/** @deprecated One-release rollback alias of `/api/restaurants/[slug]/staff-accounts` (plan §5.4); removed in batch 2. */
import { legacyStoreApi } from '@/lib/legacy-store-api';
import { GET as storeGET, POST as storePOST } from '@/app/api/restaurants/[slug]/staff-accounts/route';

export const runtime = 'nodejs';

export const GET = legacyStoreApi(storeGET);
export const POST = legacyStoreApi(storePOST);
